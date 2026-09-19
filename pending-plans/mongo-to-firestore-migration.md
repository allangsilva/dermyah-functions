# Mongo Atlas → Firestore Migration — dermyah-functions

## Context

`dermyah-functions` used MongoDB Atlas (via Mongoose) for all application data: `users`,
`print`, `appVersion`, `usersBackup`. Goal: stop depending on Atlas and move onto Firestore,
the GCP-native equivalent, since the app already lives on GCP App Engine and already uses
GCS + Vertex AI with the same service account.

## What was found by inspecting the live GCP project (`dermyah`)

- Billing is now **enabled** (`billingEnabled: true`) — the blocker noted in
  `gcp-prod-deployment-setup.md` has since been resolved.
- The App Engine app already exists, and its **default Firestore/Datastore database is in
  Datastore mode** (`databaseType: CLOUD_DATASTORE_COMPATIBILITY`) — auto-provisioned when
  the App Engine app was first created, years before this migration, and not used by this
  app for anything. A GCP project can only have one database literally named `(default)`,
  and the `@google-cloud/firestore` Native-mode client library doesn't work against a
  Datastore-mode database. **Decision: create a second, named Firestore database in Native
  mode** (`dermyah-app`) rather than trying to reuse or convert the existing default one.
- `firestore.googleapis.com` (Native mode API) is **not enabled** yet; only
  `datastore.googleapis.com` is (from the legacy default database).
- Both service accounts the app already runs as — `dermyah@appspot.gserviceaccount.com`
  (App Engine runtime default) and `firebase-adminsdk-0zyej@dermyah.iam.gserviceaccount.com`
  (the one in `firebaseServiceAccount.json`, used for GCS/Vertex AI) — already hold
  `roles/editor` at the project level, which covers Firestore/Datastore read-write. **No new
  IAM bindings are needed.**
- Secret Manager, the CI/CD pipeline, and all the non-Mongo secrets (`dermyah-jwt-secret`,
  `dermyah-admin-key`, `dermyah-infra-key`, `dermyah-gcs-service-account`) already exist and
  work — that part of `gcp-prod-deployment-setup.md` is done. Only `dermyah-mongo-url`
  becomes obsolete here.

## Code changes made

- `src/database/index.js`: now creates a `@google-cloud/firestore` client instead of a
  Mongoose connection. Reads `GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT` and
  `FIRESTORE_DATABASE_ID` (new env var, defaults to `(default)`). Auth comes from
  `GOOGLE_APPLICATION_CREDENTIALS` (already set in `app.yaml` for Vertex AI) via Application
  Default Credentials — no explicit credential file is required at import time, so local dev
  isn't broken for developers who don't have `firebaseServiceAccount.json`.
- `src/database/firestoreModel.js` (new): a small factory giving each collection
  Mongoose-like `create`/`findOne`/`findById`/`find`/`deleteMany`, and a `.save()` method on
  returned docs — kept the four model files and the controllers almost unchanged.
- `src/models/{User,PrintResult,AppVersion,UserBackup}.js`: now each just
  `createModel('<collectionName>')`, same collection names as before.
- Controllers: dropped all `mongoose.Types.ObjectId` casting/validation (meaningless for
  Firestore's string doc IDs — a bad ID now falls through to the existing "not found" path
  instead of a separate "invalid ID" 400). `UserController.get`'s `$or` case-insensitive
  regex search doesn't have a Firestore equivalent, so it now fetches all users and filters
  in memory — fine at this app's scale (an admin-only user list for a physical-device app,
  not a public search). `PrintController.get`'s date-range filter now builds a real
  `.where('createdAt', '>=', ...)` Firestore range query.
- `src/scripts/seedDevUser.js`: rewritten against the Firestore emulator (guarded by
  `FIRESTORE_EMULATOR_HOST` instead of a `mongodb://localhost` check) and re-implements the
  old upsert without Mongoose's `findOneAndUpdate`.
- `src/scripts/migrateMongoToFirestore.js` (new): one-off script to copy every existing
  document from Atlas into Firestore, reusing each document's Mongo ObjectId (hex string) as
  its new Firestore document ID, so string references like `PrintResult.userId` keep working
  unchanged. **Not run yet** — needs the real `MONGO_URL` and a Firestore database to exist
  first (see setup below). Delete this script (and the `mongodb` devDependency it needs)
  once it's been run successfully.
- `docker-compose.dev.yml`: swapped the local Mongo container for a Firestore emulator
  (`mtlynch/firestore-emulator-docker` on port 8080). Local dev now sets
  `FIRESTORE_EMULATOR_HOST=localhost:8080` instead of `MONGO_URL`.
- `package.json`: removed `mongoose`, added `@google-cloud/firestore`.
- `app.yaml` / `app.yaml.sample`: removed `MONGO_URL`, added `FIRESTORE_DATABASE_ID:
  dermyah-app`.
- `.github/workflows/deploy.yml`: removed the `dermyah-mongo-url` secret fetch.
- `AGENTS.md`: updated to describe Firestore instead of Mongo.

## GCP setup — done

```
gcloud services enable firestore.googleapis.com --project=dermyah

gcloud firestore databases create \
  --project=dermyah \
  --database=dermyah-app \
  --location=us-central1 \
  --type=firestore-native
```

Both run 2026-09-19. `us-central1` matches the App Engine app's existing region/location. No
IAM changes were needed (see above) — this was purely additive and didn't touch the existing
default Datastore-mode database, which nothing in this app uses. Verified connectivity
read-only with `firebaseServiceAccount.json` against `projects/dermyah/databases/dermyah-app`
(`listCollections()` succeeded, returned empty as expected pre-migration).

## Secrets update — done

- `dermyah-mongo-url` was **deleted** from Secret Manager (2026-09-19), since nothing in the
  code references it anymore — `.github/workflows/deploy.yml` no longer fetches it. Deleting
  it doesn't affect the currently-*running* App Engine version (env vars are baked in at
  deploy time, not read live), but note: don't deploy any older commit whose
  `deploy.yml`/`app.yaml.sample` still expects `dermyah-mongo-url` to exist — it won't.
- No new secret was needed for Firestore: it authenticates via the same
  `dermyah-gcs-service-account` credential (`firebaseServiceAccount.json`) already used for
  GCS/Vertex AI, since that service account already has `roles/editor`.
- `FIRESTORE_DATABASE_ID` is not a secret (just a database name) — it's a plain value baked
  into `app.yaml.sample`, not templated from Secret Manager.
- The Atlas cluster itself is still live and still has all the real data — it was **not**
  touched or decommissioned. Do that only after the data migration below is verified.

## Data migration — moot; Atlas was already retired

Before this migration could be verified, it was discovered that the Atlas cluster
(`dermyahcluster.i3tjq.mongodb.net`) was **already unreachable** — its DNS zone had no NS/SOA
records from any resolver (not a GCP-specific issue), consistent with the whole Atlas
project having been deleted rather than merely paused. This is what caused the brief prod
outage during the `gcp-prod-deployment-setup.md` deploy: a long-lived App Engine instance had
kept a warm connection since 2024, and any fresh instance (ours or an automatic restart)
would have hit this same failure regardless of anything changed in that pass.

Per the user: the Atlas cluster is intentionally retired and its data is not needed. So:

- `src/scripts/migrateMongoToFirestore.js` was **deleted** (dead code — nothing to migrate
  from), along with the `mongodb` devDependency and the `migrate:mongo-to-firestore` script
  in `package.json`.
- Firestore (`dermyah-app` database) now starts empty — there is no historical prod data.
- No further action needed on the Atlas side; it was already gone before this plan ran.

## Local dev

`docker-compose.dev.yml` now runs a Firestore emulator instead of Mongo. Same workflow as
before: `yarn install && yarn start` (prestart brings up the emulator via `docker compose up
--wait`). `yarn seed:dev` seeds a dev user directly into the emulator.
