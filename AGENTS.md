# dermyah-functions

The real, live backend for `dermyah-app` (Express + Mongoose/MongoDB), deployed to GCP App
Engine Standard as the default service. `dermyah-api` (TS/Sequelize/MySQL, in a sibling
directory) is an abandoned, never-deployed rewrite — not this backend, not in scope.

## Routes

`src/routers/index.js` — matches exactly what `dermyah-app`'s `src/config/config.ts`
expects: `/login`, `/classify`, `/upload`, `/users/webserver`, `/appversion/:platform?`,
plus admin/print/backup routes behind `auth`/`checkIfAdmin` middleware.

## Running locally

1. Local `.env` (gitignored) with **fresh, throwaway values**, not the real Mongo Atlas
   cluster:
   ```
   PORT=3000
   MONGO_URL=mongodb://localhost:27017/dermyah-dev
   JWT_SECRET=<random>
   JWT_EXPIRES_IN=7d
   ADMIN_KEY=<random>
   ```
   Leave `GCS_BUCKET`/`GCLOUD_PROJECT`/`GCS_KEYFILE`/`CLASSIFICATION_HOST`/
   `CLASSIFICATION_RESOURCE` blank locally — see gap below.
2. `yarn install && yarn start` — that's it. `prestart` brings up the throwaway local
   Mongo via `docker compose -f docker-compose.dev.yml up -d --wait` (waits on its
   healthcheck, so Mongo is actually ready to accept connections before the app starts,
   not just "container running") and `start` runs nodemon on `$PORT` (3000). Requires
   Docker Desktop (or another Docker daemon) running; `docker compose` fails fast with a
   clear error if it isn't.
   - `yarn start:prod` runs the bare `node src/app.js` without touching Docker — this is
     what App Engine actually runs (see `entrypoint:` in `app.yaml`, set explicitly so
     prod never depends on what `npm start` happens to mean locally).
3. Smoke test: `curl localhost:3000/appversion/android` (low-risk route, no auth, no seed
   data needed — returns `null` on an empty DB, which is expected/correct).

**Known local-dev gap**: `/upload` and `/classify` depend on `GCS_BUCKET` (Google Cloud
Storage) and `CLASSIFICATION_HOST` (the `dermyah-shape-type` ML microservice, already
deployed on GCP, out of scope here). Neither is stood up locally — those two routes will
fail locally. Not worth mocking for this pass; document and move on unless someone
specifically needs to exercise the upload/classify flow locally.

`/login` needs seeded user data this local DB won't have — expect it to fail on a fresh
local Mongo until you seed a user via the (admin-only) `/users` create route or directly
in Mongo.

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

`app.yaml` has a **live, plaintext Mongo Atlas URI, JWT_SECRET, ADMIN_KEY, and INFRA_KEY**.
`firebaseServiceAccount.json` is a real GCP service account key. Both are kept out of this
repo's git history from the start (gitignored, `app.yaml.sample` committed as a template
instead — see above). These values themselves were **not rotated** in this pass (that
needs GCP/Atlas access this session doesn't have); this repo's local dev setup
deliberately avoids touching the real cluster so no live credentials are needed just to
run locally. Note the old Bitbucket repo (`bitbucket.org/allangaldino/dermyah-functions`)
still has these committed in its history if it's still reachable — rotation is still
worth doing regardless of this repo being clean now.

### Remediation checklist (documented, not executed)

- Rotate the Mongo Atlas credentials in the connection string.
- Rotate `JWT_SECRET` and `ADMIN_KEY` (any currently-issued JWTs become invalid — plan for
  user re-login).
- Rotate/replace `firebaseServiceAccount.json` (revoke the old service account key in GCP
  IAM, generate a new one).
- Move all of the above out of the committed `app.yaml` into GCP Secret Manager or
  App Engine environment variables set outside source control.
- Scrub git history of the old values (e.g. `git filter-repo`) — only after rotation, and
  only with explicit sign-off given how destructive rewriting history is.
