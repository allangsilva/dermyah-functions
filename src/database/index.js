const { Firestore } = require('@google-cloud/firestore');

// In prod, auth comes from GOOGLE_APPLICATION_CREDENTIALS (already set in app.yaml for
// Vertex AI) via Application Default Credentials. Locally, FIRESTORE_EMULATOR_HOST (set by
// docker-compose.dev.yml) redirects the client to the emulator and credentials aren't needed.
// The project's default database is already in Datastore-mode from App Engine's original
// provisioning, so this app uses a separate named Native-mode database instead of "(default)".
const firestore = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
    databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    // A caller-supplied field left as undefined (e.g. an optional field a client never
    // sends) would otherwise throw on write and crash the whole process (see
    // UserController.update's admin field, which used to do exactly this).
    ignoreUndefinedProperties: true,
});

module.exports = firestore;
