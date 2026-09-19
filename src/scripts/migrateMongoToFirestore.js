require("dotenv").config();

const { MongoClient } = require("mongodb");
const firestore = require("../database");

// One-off data migration: copies every document out of the live MongoDB Atlas cluster
// into the new Firestore database. Run once, then this script (and the `mongodb`
// devDependency it needs) can be deleted. See
// pending-plans/mongo-to-firestore-migration.md for context and how to run this.
//
// Mongo's ObjectId (hex string) is reused as the Firestore document ID for every
// collection, so cross-references that were stored as plain ObjectId strings (e.g.
// PrintResult.userId) keep working unchanged - no ID remapping needed.
const COLLECTIONS = ["users", "print", "appVersion", "usersBackup"];

async function migrateCollection(mongoDb, name) {
  const docs = await mongoDb.collection(name).find({}).toArray();
  console.log(`[migrate] ${name}: ${docs.length} document(s)`);

  for (let i = 0; i < docs.length; i += 500) {
    const batch = firestore.batch();
    for (const doc of docs.slice(i, i + 500)) {
      const { _id, __v, ...fields } = doc;
      batch.set(firestore.collection(name).doc(_id.toHexString()), fields);
    }
    await batch.commit();
  }
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error(
      "[migrate] MONGO_URL is required (the source Atlas connection string) - " +
        "not read from app.yaml automatically, pass it explicitly."
    );
    process.exit(1);
  }

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db();

  for (const name of COLLECTIONS) {
    await migrateCollection(db, name);
  }

  await client.close();
  console.log("[migrate] Done.");
}

main().catch((error) => {
  console.error("[migrate] Failed:", error);
  process.exit(1);
});
