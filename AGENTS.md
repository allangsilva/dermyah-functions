# dermyah-functions

The real, live backend for `dermyah-app` (Express + Firestore), deployed to GCP App
Engine Standard as the default service. `dermyah-api` (TS/Sequelize/MySQL, in a sibling
directory) is an abandoned, never-deployed rewrite — not this backend, not in scope.

Data used to live in MongoDB Atlas; it was migrated to Firestore (Native mode) — see
`pending-plans/mongo-to-firestore-migration.md` for the rationale and the GCP setup this
needed. `src/database/firestoreModel.js` is a thin factory giving each collection
Mongoose-like `create`/`findOne`/`findById`/`find`/`deleteMany` methods and a `.save()` on
returned docs, so the controllers barely had to change.

## Routes

`src/routers/index.js` — matches exactly what `dermyah-app`'s `src/config/config.ts`
expects: `/login`, `/classify`, `/upload`, `/users/webserver`, `/appversion/:platform?`,
plus admin/print/backup routes behind `auth`/`checkIfAdmin` middleware.

## Running locally

1. Local `.env` (gitignored) with **fresh, throwaway values**, pointed at the local
   Firestore emulator, not the real prod database:
   ```
   PORT=3000
   FIRESTORE_EMULATOR_HOST=localhost:8080
   JWT_SECRET=<random>
   JWT_EXPIRES_IN=7d
   ADMIN_KEY=<random>
   ```
   Leave `GCS_BUCKET`/`GCLOUD_PROJECT`/`GCS_KEYFILE` blank locally — see gap below.
2. `yarn install && yarn start` — that's it. `prestart` brings up the throwaway local
   Firestore emulator via `docker compose -f docker-compose.dev.yml up -d --wait` (waits
   on its healthcheck, so the emulator is actually ready to accept connections before the
   app starts, not just "container running") and `start` runs nodemon on `$PORT` (3000).
   Requires Docker Desktop (or another Docker daemon) running; `docker compose` fails
   fast with a clear error if it isn't. `FIRESTORE_EMULATOR_HOST` being set is what
   redirects the `@google-cloud/firestore` client to the emulator instead of prod — no
   credentials needed locally.
   - `yarn start:prod` runs the bare `node src/app.js` without touching Docker — this is
     what App Engine actually runs (see `entrypoint:` in `app.yaml`, set explicitly so
     prod never depends on what `npm start` happens to mean locally).
3. Smoke test: `curl localhost:3000/appversion/android` (low-risk route, no auth, no seed
   data needed — returns `null` on an empty DB, which is expected/correct).

**Known local-dev gap**: `/upload` and `/classify` depend on `GCS_BUCKET` (Google Cloud
Storage) and, since `/classify` now runs its face-shape classification in-process via
Gemini (Vertex AI), also need `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION`, and `GOOGLE_GENAI_USE_ENTERPRISE` pointed at a real GCP project
with the Vertex AI API enabled and the service account granted `roles/aiplatform.user`.
Neither GCS nor Gemini is stood up for throwaway local dev — those two routes will fail
locally. Not worth mocking for this pass; document and move on unless someone
specifically needs to exercise the upload/classify flow locally.

`/login` needs seeded user data this local DB won't have — expect it to fail on a fresh
local Firestore emulator until you seed a user via the (admin-only) `/users` create route,
`yarn seed:dev`, or directly in the emulator.

## Deploy / hosting

- GCP App Engine Standard, default service. `app.yaml` sets `runtime: nodejs16` —
  **deprecated**, should move to a supported runtime (`nodejs20`). Not changed in this
  pass — informational only, no infra changes without explicit request.
- `app.yaml` is **gitignored** (it holds live secrets — see below). Copy
  `app.yaml.sample` to `app.yaml` and fill in real values before running `make deploy` on
  a fresh clone. The real `app.yaml` and `firebaseServiceAccount.json` already exist
  locally on the machine this was set up on; don't delete them.
- `Makefile`: `make deploy` (`gcloud app deploy`), `make deploy-cron`, `make logs`.
- Consider whether App Engine Standard is still the right target vs. Cloud Run — no
  action needed unless requested, just worth knowing Cloud Run is simpler to reason about
  for a single Express service like this.

## Security exposure — secrets

`app.yaml` (gitignored) has a **live, plaintext JWT_SECRET, ADMIN_KEY, and INFRA_KEY**;
`app.yaml.sample` is the committed template with these substituted from GCP Secret Manager
at deploy time (see `.github/workflows/deploy.yml`). `firebaseServiceAccount.json` is a real
GCP service account key, also gitignored. These values themselves were **not rotated** in
the pass that found them; this repo's local dev setup deliberately avoids touching real
prod data so no live credentials are needed just to run locally. Note the old Bitbucket repo
(`bitbucket.org/allangaldino/dermyah-functions`) still has an old MongoDB Atlas connection
string committed in its history if it's still reachable — the data has since moved to
Firestore (see `pending-plans/mongo-to-firestore-migration.md`), but that old Atlas cluster
and credential should still be decommissioned/rotated if not already done.

### Remediation checklist (documented, not executed)

- Rotate `JWT_SECRET`, `ADMIN_KEY`, and `INFRA_KEY` (any currently-issued JWTs become
  invalid — plan for user re-login).
- Rotate/replace `firebaseServiceAccount.json` (revoke the old service account key in GCP
  IAM, generate a new one).
- Decommission the old MongoDB Atlas cluster once the Firestore migration is verified in
  prod, and delete the now-unused `dermyah-mongo-url` secret in Secret Manager.
- Scrub git history of the old Bitbucket repo's values (e.g. `git filter-repo`) — only
  after rotation, and only with explicit sign-off given how destructive rewriting history
  is.
