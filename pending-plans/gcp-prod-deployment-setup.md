# GCP Prod Deployment Setup — dermyah-functions

## Context

`dermyah-functions` (Express + Mongoose/MongoDB) is the live backend for `dermyah-app`, meant
to run on GCP App Engine Standard, project `dermyah`. Today deploys are entirely manual from
one laptop (`make deploy` → `gcloud app deploy`), secrets live in a gitignored `app.yaml` that
was never rotated, there's no CI/CD, and (per direct inspection of the GCP project via
`gcloud`) the only GCP-side setup that's actually done is a billing account — and even that
isn't currently active on this project. The goal is to get to: push to `main` → GitHub Actions
deploys to App Engine automatically, with app secrets stored in **GCP Secret Manager** rather
than GitHub (per preference — GitHub only holds the one credential needed to authenticate to
GCP in the first place), on a supported Node runtime.

Face-shape classification was moved off the old standalone `dermyah-shape-type` microservice
and now runs in-process in `dermyah-functions` via Gemini (Vertex AI / Gemini Enterprise Agent
Platform), reusing the existing `firebaseServiceAccount.json` credential — no new secret to
manage for this. That migration adds its own manual GCP prerequisite (below) that's still
pending and is independent of the deploy-pipeline work in this plan.

## What was found by inspecting the live GCP project (`dermyah`) and this repo

- **Billing is disabled on the project** (`billingEnabled: false`), linked to billing account
  `01B271-7D1613-42D276` which the current gcloud identity (`agaldino12333@gmail.com`) can't
  even see — it's likely controlled by a separate `dermyahads@gmail.com` account (which holds
  `roles/billing.projectManager` on the project). This is why `gcloud app describe` fails
  outright — **it blocks everything below until fixed.** Decision made: re-enable this
  original billing account rather than switch to a different one.
- App Engine Admin API, Cloud Build API, and Cloud Storage are already enabled; `gs://dermyah`
  (the bucket the app uses) already exists.
- `runtime: nodejs16` in `app.yaml`/`app.yaml.sample` is deprecated (already flagged in
  `AGENTS.md`).
- A service account `github-deployer@dermyah.iam.gserviceaccount.com` **already exists** with
  one key (created 2026-02-26) — but it has **zero IAM roles** bound at the project level, so
  it can't deploy anything as-is, and it's unknown whether the private key material still
  exists anywhere. This looks like a prior half-finished attempt at exactly this task.
- No `.github/workflows/` directory exists — no CI/CD at all.
- The GitHub CLI is authenticated as `allangaldinosilva`, but got an HTTP 403 listing secrets
  on `github.com/allangsilva/dermyah-functions` — **that account may not have admin rights on
  the repo**, which is required to create Actions secrets. Needs to be confirmed before step 8.
- `Secret Manager` API (`secretmanager.googleapis.com`) is **not enabled** on the project yet —
  needed for the plan below.
- Real secrets currently in use: `MONGO_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_KEY`,
  `INFRA_KEY`, plus the `firebaseServiceAccount.json` key file (used as
  `GOOGLE_APPLICATION_CREDENTIALS`/`GCS_KEYFILE` for GCS access). `AGENTS.md` already documents
  that none of these have been rotated despite historical exposure risk (old Bitbucket repo).

## Step-by-step plan

### 1. Re-enable billing on the `dermyah` project (blocking, manual)
Whoever controls `dermyahads@gmail.com` needs to go to GCP Console → Billing → account
`01B271-7D1613-42D276` and re-enable it (fix expired card / reactivate). Verify with:
```
gcloud app describe --project=dermyah
```
Once this stops erroring with a billing-related permission denial, proceed.

### 2. Confirm/create the App Engine application
Once billing works, check whether an App Engine app instance already exists:
```
gcloud app describe --project=dermyah
```
If it 404s (no app yet), create one — **the region is permanent and cannot be changed later**,
so confirm before running:
```
gcloud app create --project=dermyah --region=us-central1
```
(`us-central1` is a reasonable default matching the project's existing US-multiregion storage;
confirm before running since it's irreversible.)

### 3. Move off the deprecated Node runtime
Edit `app.yaml.sample`:
```diff
- runtime: nodejs16
+ runtime: nodejs20
```
Update the real (gitignored) `app.yaml` on the deploy machine to match. `nodejs16` is
deprecated and may already be blocked for new deploys.

### 4. Enable Vertex AI for the in-process face-shape classifier (blocking for `/classify`)
The old standalone `dermyah-shape-type` classifier was replaced with an in-process Gemini
call (Vertex AI / Gemini Enterprise Agent Platform) reusing the existing
`firebaseServiceAccount.json` service account — this still needs its own one-time GCP setup,
independent of the deploy-pipeline work above. Until this is done, every `/classify` call
fails closed with a 503 rather than crashing.
```
gcloud services enable aiplatform.googleapis.com --project=dermyah

gcloud projects add-iam-policy-binding dermyah \
  --member="serviceAccount:<client_email from firebaseServiceAccount.json>" \
  --role="roles/aiplatform.user"
```
Then confirm `GOOGLE_GENAI_USE_ENTERPRISE=true` and `GOOGLE_CLOUD_LOCATION=us-central1` are
set in the real `app.yaml` (already added to `app.yaml.sample` as a template) before the next
deploy — `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS` are already present.

### 5. Rotate the currently-exposed secrets
Per `AGENTS.md`'s existing remediation checklist, before loading these into Secret Manager:
- Rotate the Mongo Atlas connection string credentials.
- Rotate `JWT_SECRET` and `ADMIN_KEY` (existing JWTs become invalid — expect user re-login).
- Rotate `INFRA_KEY`.
- Revoke the old `firebaseServiceAccount.json` key in GCP IAM and generate a fresh one for
  whichever service account it belongs to (used for GCS access).

### 6. Enable Secret Manager and create the secrets
```
gcloud services enable secretmanager.googleapis.com --project=dermyah
```
Create one secret per value (rotated values from step 5), e.g.:
```
echo -n "<rotated-mongo-url>" | gcloud secrets create dermyah-mongo-url --project=dermyah --data-file=-
echo -n "<rotated-jwt-secret>" | gcloud secrets create dermyah-jwt-secret --project=dermyah --data-file=-
echo -n "<rotated-admin-key>" | gcloud secrets create dermyah-admin-key --project=dermyah --data-file=-
echo -n "<rotated-infra-key>" | gcloud secrets create dermyah-infra-key --project=dermyah --data-file=-
gcloud secrets create dermyah-gcs-service-account --project=dermyah --data-file=firebaseServiceAccount.json
```
(Re-running with `gcloud secrets versions add <name> --data-file=-` is how these get rotated
again in the future — no GitHub secret updates ever needed for app secrets going forward.)

### 7. Fix the `github-deployer` service account
It already exists but has no permissions and an unverified key. Grant it deploy-capable roles
plus read access to the secrets from step 6:
```
gcloud projects add-iam-policy-binding dermyah \
  --member="serviceAccount:github-deployer@dermyah.iam.gserviceaccount.com" \
  --role="roles/appengine.appAdmin"

gcloud projects add-iam-policy-binding dermyah \
  --member="serviceAccount:github-deployer@dermyah.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding dermyah \
  --member="serviceAccount:github-deployer@dermyah.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding dermyah \
  --member="serviceAccount:github-deployer@dermyah.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding dermyah \
  --member="serviceAccount:github-deployer@dermyah.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```
Generate a fresh key (don't rely on the old, unverified one) and delete the old key
(`65b5237a145b77cf4159a5e564ade50660302723`) once the new one is confirmed working:
```
gcloud iam service-accounts keys create github-deployer-key.json \
  --iam-account=github-deployer@dermyah.iam.gserviceaccount.com --project=dermyah
```

### 8. Confirm GitHub repo admin access, then add the one required repo secret
First confirm whichever GitHub account will do this has admin access to
`allangsilva/dermyah-functions` (the `gh` CLI's current login got a 403 on secrets — may need
a different account or a re-auth). Then add just the deploy credential as an Actions secret
(Settings → Secrets and variables → Actions), or via `gh secret set`:
- `GCP_SA_KEY` — full contents of `github-deployer-key.json` from step 7

This is the only secret GitHub needs to hold — it's what lets the workflow authenticate to GCP
and pull everything else from Secret Manager at deploy time.

### 9. Add a GitHub Actions deploy workflow
Create `.github/workflows/deploy.yml`: on push to `main`, checkout, auth to GCP via
`google-github-actions/auth` using the `GCP_SA_KEY` secret, then at deploy time pull each value
straight from Secret Manager (e.g. `gcloud secrets versions access latest --secret=dermyah-mongo-url
--project=dermyah`) into env vars, write `dermyah-gcs-service-account`'s contents out to
`firebaseServiceAccount.json`, generate `app.yaml` from the existing `app.yaml.sample` template
by substituting those values into the blank `env_variables` entries (e.g. `envsubst`), then run
`gcloud app deploy --project=dermyah --quiet`. Given there's no staging environment and this
deploys straight to prod, use a GitHub Environment (e.g. `production`) with a required reviewer
as a manual gate before the deploy step runs.

### 10. Verify
After the first automated deploy, confirm the live app responds:
```
curl https://dermyah.appspot.com/appversion/android
```
(low-risk route per `AGENTS.md`, expects `null` on a fresh/empty prod DB — but here it should
return real data since Mongo Atlas has prod data already).

### 11. Manually smoke-test the Gemini face-shape classifier end-to-end
Once step 4 is done and the app is deployed with the new env vars, verify `/classify` actually
works against live Gemini/Vertex AI before relying on it:
1. Upload a small set of real face photos via `POST /upload` (or `gsutil cp` into the
   `dermyah` bucket) covering: all 5 shapes (oblong, oval, round, square, triangle), one photo
   with no face, one with two faces, and one blurry/occluded photo.
2. Call `POST /classify` with each `imagePath` (curl/Postman) and confirm: correct HTTP status
   (200 for a clean classification, 400 for the no-face/multi-face/unusable-image/garbage
   cases, 503 if Gemini or GCS itself is unreachable), `classification.type` matches
   expectation, and `classification.precision` is a sane numeric string.
3. For the 200 cases, confirm the source file is actually deleted from the bucket afterward
   (`gsutil ls`) — the existing fire-and-forget delete still runs against the rewritten
   service.
4. Do a quick check of `dermyah-app`'s handling of `/classify` responses (or a manual
   end-to-end test with a build of the client) to confirm it doesn't key off any literal
   string the old Flask service used to return, or do anything status-code-specific beyond
   treating non-200 as failure.

### 12. Decommission the old `dermyah-shape-type` service
Once step 11 passes, tear down the standalone Flask VM/App Engine service at
`34.151.214.175:5000` — this also closes an existing security gap (that endpoint had no
auth). Confirm nothing else still points at it before deleting the instance.

## Not doing now (flagged for later, out of scope for this pass)
- Having the app itself fetch secrets from Secret Manager at runtime (via the App Engine
  default service account's identity) instead of baking them into `app.yaml`'s
  `env_variables` at CI deploy time. That's the more idiomatic Secret-Manager-on-App-Engine
  pattern (secrets never touch the deployed version's config, App Engine Standard has no
  native secret-mounting like Cloud Run does), but requires a small code change at app boot —
  out of scope for a deploy-infra pass.
- Switching GCS auth from a static service-account key file to Application Default Credentials
  via the App Engine default service account (would remove a live secret from the pipeline
  entirely, but requires a small code change in wherever the GCS client is instantiated).
- Switching GitHub Actions → GCP auth to Workload Identity Federation (keyless) instead of a
  static SA key (simpler key-in-secret approach chosen instead).
- Scoping down the overly broad `roles/editor` currently held by the App Engine default service
  account and the `firebase-adminsdk-*` service accounts.
- Scrubbing old exposed secrets from the historical Bitbucket repo's git history.

## Verification
- `gcloud app describe --project=dermyah` succeeds (billing fixed, app exists).
- A push to `main` triggers the new workflow in the GitHub Actions tab and completes green.
- `curl https://dermyah.appspot.com/appversion/android` returns a real response post-deploy.
- `gcloud app logs tail -s default --project=dermyah` shows the app booting without missing-env
  errors.
- `POST /classify` returns real Gemini-backed classifications per step 11, instead of 503s.
- The old `dermyah-shape-type` VM/service is torn down (step 12) and nothing in either repo
  still references `CLASSIFICATION_HOST`/`CLASSIFICATION_RESOURCE` or the bare IP.
