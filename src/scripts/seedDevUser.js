require("dotenv").config();

const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const User = require("../models/User");

const DEV_EMAIL = "allan@dermyah.com";
const DEV_PASSWORD = "asd123";

async function main() {
  const mongoUrl = process.env.MONGO_URL || "";

  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(mongoUrl)) {
    console.error(
      `[seedDevUser] Refusing to run: MONGO_URL "${mongoUrl}" doesn't look like a local database. ` +
        "This script is for dev/local use only."
    );
    process.exit(1);
  }

  await mongoose.connect(mongoUrl, {
    useNewUrlParser: true,
    useFindAndModify: true,
  });

  const password = await bcryptjs.hash(DEV_PASSWORD, 8);

  const user = await User.findOneAndUpdate(
    { email: DEV_EMAIL },
    {
      $set: {
        email: DEV_EMAIL,
        password,
        name: "Allan (dev)",
        admin: true,
      },
      $setOnInsert: {
        config: { connectionType: "BLUETOOTH" },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`[seedDevUser] Seeded dev user: ${user.email} (password: ${DEV_PASSWORD})`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[seedDevUser] Failed to seed dev user:", error);
  process.exit(1);
});
