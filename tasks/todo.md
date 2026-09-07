# Deploy to Closed Beta — Task List

Plan: `tasks/plan.md`. Spec: `SPEC.md`. Branch: `v2` (merges to `main` at Task 16).
Do tasks in order. `[operator]` tasks are done by the user in a web console with
the agent supplying exact steps/values and verifying the result.

---

## Task 1: Commit current `v2` working tree

**Description:** `v2` has ~2000 uncommitted lines mixing feature work and earlier
deploy prep. Commit it as-is so all subsequent deployment changes land in
isolated, reviewable commits.

**Acceptance criteria:**
- [ ] `git status` is clean except for intentionally-untracked files
- [ ] `.pyc` / `.DS_Store` are NOT part of this commit (handled in Task 2 — for
      now stage source only)
- [ ] Commit message describes the bundled state honestly

**Verification:**
- [ ] `git log -1 --stat` shows the expected files
- [ ] `cd backend && python manage.py check` passes
- [ ] `cd backend && python manage.py runserver` boots

**Dependencies:** None

**Files likely touched:** (git only — no content changes)

**Estimated scope:** S

---

## Task 2: Repo hygiene — untrack secrets/artifacts, fix `.gitignore`

**Description:** Stop tracking `.env` files, `db.sqlite3`, `__pycache__`/`*.pyc`,
and `.DS_Store`. Add root `.env.example` placeholders are handled in Tasks 8/12;
here just remove and ignore.

**Acceptance criteria:**
- [ ] `.gitignore` (root) covers: `.env`, `*.env` (except `*.env.example`),
      `**/__pycache__/`, `*.pyc`, `.DS_Store`, `backend/db.sqlite3`
- [ ] `git rm --cached` run for: `.env`, `backend/db.sqlite3`, all tracked
      `*.pyc`, all tracked `.DS_Store`, `db.sqlite3` (root)
- [ ] Local files remain on disk (only untracked, not deleted)
- [ ] `git ls-files` returns none of the above patterns

**Verification:**
- [ ] `git ls-files | grep -E '\.env$|db\.sqlite3|\.pyc$|\.DS_Store'` → empty
- [ ] `cd backend && python manage.py runserver` still works (local SQLite intact)

**Dependencies:** 1

**Files likely touched:**
- `.gitignore`
- `frontend/.gitignore` (verify it already covers `.env`; it does)

**Estimated scope:** S

---

## Task 3: Commit migrations 0006–0008, verify no model drift

**Description:** Migrations `0006_collection`, `0007_alter_log_rating`,
`0008_collection_is_watchlist` exist on disk but are untracked. Commit them and
confirm models and migrations agree.

**Acceptance criteria:**
- [ ] The three migration files are tracked and committed
- [ ] `python manage.py makemigrations --check --dry-run` reports nothing to do
- [ ] `python manage.py migrate` runs clean on a fresh SQLite DB

**Verification:**
- [ ] `cd backend && python manage.py makemigrations --check --dry-run` → exit 0
- [ ] `rm /tmp/test.sqlite3; DATABASE_URL=sqlite:////tmp/test.sqlite3 python manage.py migrate` succeeds

**Dependencies:** 1

**Files likely touched:**
- `backend/movie_csv/migrations/0006_collection.py`
- `backend/movie_csv/migrations/0007_alter_log_rating.py`
- `backend/movie_csv/migrations/0008_collection_is_watchlist.py`

**Estimated scope:** S

---

## Task 4: Delete root-level pre-restructure cruft

**Description:** Remove leftovers from before the `backend/` restructure:
`/main.py`, `/movie_csv/` (has its own `urls.py`), `/media/`, root `/db.sqlite3`,
root `/package.json` + `/package-lock.json`. Confirmed: nothing under `backend/`
or `frontend/` imports these; `backend/movie_csv/` is the live app.

**Acceptance criteria:**
- [ ] Grep confirms no reference from `backend/`, `frontend/`, or `render.yaml`
      to any deleted path
- [ ] Files removed and the removal committed
- [ ] `cd backend && python manage.py check` still passes

**Verification:**
- [ ] `grep -rn "main\.py\|root package\|\.\./movie_csv" backend frontend` → no hits
- [ ] `cd backend && python manage.py runserver` boots
- [ ] `cd frontend && npx tsc --noEmit` passes

**Dependencies:** 2

**Files likely touched:** (deletions)
- `main.py`, `movie_csv/`, `media/`, `db.sqlite3`, `package.json`, `package-lock.json` (all repo root)

**Estimated scope:** S

---

### CHECKPOINT A — review with human before Task 5
- [ ] `git ls-files` clean of secrets/artifacts
- [ ] Local dev unchanged: `runserver` boots, admin loads, `check` passes
- [ ] Root cruft gone, nothing broke

---

## Task 5: Env-driven `settings.py` — debug/secret/hosts/CORS/security

**Description:** Replace hardcoded dev values with environment reads plus safe
local defaults, per the Code Style snippet in `SPEC.md`. Covers `DEBUG`,
`SECRET_KEY` (raise if missing when not debug), `ALLOWED_HOSTS`,
`CSRF_TRUSTED_ORIGINS`, CORS allowlist (no wildcard when not debug), and the
production security block (SSL redirect, proxy header, secure cookies, HSTS).

**Acceptance criteria:**
- [ ] No `SECRET_KEY`, host, or origin literal remains in `settings.py` (dev
      fallback string for `SECRET_KEY` only, gated on `DEBUG`)
- [ ] With `DJANGO_DEBUG` unset and prod vars provided: `check --deploy` → 0 issues
- [ ] With no env vars: `DEBUG=True`, SQLite, `runserver` works, `CORS_ALLOW_ALL_ORIGINS=True`
- [ ] Duplicate middleware entries (`SecurityMiddleware`, `SessionMiddleware`
      appear twice today) de-duplicated

**Verification:**
- [ ] `cd backend && python manage.py check` (no env) → passes
- [ ] `DJANGO_SECRET_KEY=x DJANGO_ALLOWED_HOSTS=example.com CLERK_ISSUER=https://x python manage.py check --deploy` → 0 issues
- [ ] `grep -nE "SECRET_KEY *= *['\"]django-insecure-@|ALLOWED_HOSTS *= *\[\"\\*\"\]" backend/config/settings.py` → only the DEBUG-gated fallback

**Dependencies:** 3

**Files likely touched:**
- `backend/config/settings.py`

**Estimated scope:** M

---

## Task 6: Database via `dj-database-url` + WhiteNoise static pipeline

**Description:** Wire `dj_database_url.config()` with a SQLite fallback for the
`default` database. Add WhiteNoise: middleware directly after
`SecurityMiddleware`, `STATIC_ROOT = BASE_DIR / "staticfiles"`, and
`STORAGES["staticfiles"]` set to WhiteNoise compressed manifest storage.

**Acceptance criteria:**
- [ ] `DATABASE_URL=postgres://...` switches the DB with no code change; unset → SQLite
- [ ] `collectstatic --noinput` succeeds and populates `staticfiles/`
- [ ] `staticfiles/` is gitignored
- [ ] `runserver` with `DEBUG=False` + `collectstatic` done → `/admin/` renders with CSS

**Verification:**
- [ ] `cd backend && python manage.py collectstatic --noinput` → success
- [ ] `DJANGO_DEBUG= DJANGO_SECRET_KEY=x DJANGO_ALLOWED_HOSTS=127.0.0.1 CLERK_ISSUER=https://x python manage.py runserver` then `curl -sI localhost:8000/admin/` → 302→login, static assets 200
- [ ] `python -c "import dj_database_url"` (dep present)

**Dependencies:** 5

**Files likely touched:**
- `backend/config/settings.py`
- `.gitignore`

**Estimated scope:** S

---

## Task 7: Clerk config to env; JWKS cache TTL; logging not `print`

**Description:** In `authentication.py` and `settings.py`: read `CLERK_ISSUER`
from env (dev default only when `DEBUG`), derive `CLERK_JWKS_URL` from it. Give
the JWKS cache a timestamp + TTL (e.g. 10 min) instead of caching forever.
Optionally accept a second issuer via `CLERK_ISSUER_LEGACY` to bridge the
dev→prod cutover. Replace `print(...)` with `logging.getLogger(__name__)`.

**Acceptance criteria:**
- [ ] `authentication.py` has no hardcoded issuer/JWKS URL and no `print`
- [ ] JWKS refetches after TTL; within TTL it does not hit the network
- [ ] Missing/blank `Authorization` header → returns `None` (unchanged)
- [ ] Malformed token → `AuthenticationFailed` (unchanged)

**Verification:**
- [ ] `cd backend && python manage.py test movie_csv` → auth tests pass (added in Task 8)
- [ ] `grep -n "print(" backend/movie_csv/authentication.py` → empty
- [ ] `grep -n "splendid-sunbird" backend/movie_csv/authentication.py` → empty

**Dependencies:** 5

**Files likely touched:**
- `backend/movie_csv/authentication.py`
- `backend/config/settings.py`

**Estimated scope:** S

---

## Task 8: Backend smoke tests + `.env.example` + `runtime.txt`

**Description:** Add the smoke tests from `SPEC.md` Testing Strategy. Add
`backend/.env.example` (names only, no values) and `backend/runtime.txt`
(`python-3.13.x`).

**Acceptance criteria:**
- [ ] `tests.py` covers: `check --deploy` clean under prod env; `ClerkAuthentication`
      none/malformed/valid(mocked JWKS); list endpoint 401 unauth / 200 auth for
      `VideoEssay`, `Log`, `Collection`
- [ ] `backend/.env.example` lists every var the app reads:
      `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`,
      `DJANGO_CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`,
      `CLERK_ISSUER`, `CLERK_ISSUER_LEGACY`, `SERPAPI_KEY`
- [ ] `backend/runtime.txt` pins the Python minor version

**Verification:**
- [ ] `cd backend && python manage.py test` → all pass
- [ ] `python manage.py makemigrations --check --dry-run` → clean
- [ ] Every name in `.env.example` appears in an `os.environ`/`getenv` call in source

**Dependencies:** 6, 7

**Files likely touched:**
- `backend/movie_csv/tests.py`
- `backend/users/tests.py`
- `backend/.env.example`
- `backend/runtime.txt`

**Estimated scope:** M

---

### CHECKPOINT B — review with human before Render provisioning
- [ ] Prod env + `DJANGO_DEBUG` unset → `check --deploy` 0 issues
- [ ] No env vars → local dev works (SQLite, runserver, admin)
- [ ] `python manage.py test` passes; `makemigrations --check` clean
- [ ] `collectstatic --noinput` succeeds

---

## Task 9: Add `render.yaml` Blueprint

**Description:** Repo-root `render.yaml` defining a Python web service (backend),
a static site (frontend web), and a free PostgreSQL instance, with env-var
wiring. `DATABASE_URL` from the Postgres resource; `DJANGO_SECRET_KEY` generated;
`SERPAPI_KEY` / `CLERK_ISSUER` / `EXPO_PUBLIC_*` marked `sync: false` (set in
dashboard).

**Acceptance criteria:**
- [ ] Web service: build `pip install -r backend/requirements.txt`; pre-deploy
      `python backend/manage.py migrate`; start
      `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
- [ ] Static site: build `cd frontend && npm ci && npx expo export --platform web`;
      publish path `frontend/dist`; SPA rewrite `/* -> /index.html`
- [ ] `DJANGO_DEBUG` set to empty/false; `DJANGO_ALLOWED_HOSTS` and CORS/CSRF
      origins reference the Render URLs
- [ ] Postgres plan is `free`

**Verification:**
- [ ] `render.yaml` validates (YAML lint; Render Blueprint preview shows 3 resources)
- [ ] Manual read-through against Render Blueprint spec docs

**Dependencies:** 6, 7

**Files likely touched:**
- `render.yaml`

**Estimated scope:** S

---

## Task 10: [operator] Create Clerk production instance, capture keys

**Description:** In the Clerk dashboard, create a **production** instance for the
app. Record: Frontend API / issuer URL, publishable key, and (if used) any
JWT template. Add the Render frontend origin to Clerk's allowed origins once
known (revisit after Task 13).

**Acceptance criteria:**
- [ ] Production instance exists
- [ ] Issuer URL, publishable key captured (paste into Render env in Task 11/13, not into git)
- [ ] Sign-in methods match the dev instance (email/password etc.)

**Verification:**
- [ ] `curl -s <issuer>/.well-known/jwks.json` returns keys
- [ ] Issuer differs from `splendid-sunbird-55.clerk.accounts.dev`

**Dependencies:** None (can run in parallel with Tasks 1–9)

**Files likely touched:** none (dashboard + secrets)

**Estimated scope:** S

---

## Task 11: [operator] Provision backend + Postgres on Render, run migrations

**Description:** Create the Blueprint from `render.yaml`. Set dashboard env vars:
`DJANGO_SECRET_KEY` (generate), `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`,
`CORS_ALLOWED_ORIGINS`, `SERPAPI_KEY` (rotate the one from git history),
`CLERK_ISSUER` (from Task 10). Confirm the pre-deploy migrate ran; create a
superuser via Render shell.

**Acceptance criteria:**
- [ ] Web service build + deploy succeeds; service is "live"
- [ ] `GET /admin/` loads with CSS over HTTPS
- [ ] `python manage.py migrate` shows all applied (check deploy logs)
- [ ] Superuser created; can log into `/admin/`

**Verification:**
- [ ] `curl -sI https://<backend>.onrender.com/admin/` → 302 to login, HSTS header present, `X-Forwarded-Proto` honored (no redirect loop)
- [ ] `curl -s https://<backend>.onrender.com/api/videoessays/` → 401 (no token)
- [ ] `python manage.py check --deploy` in Render shell → 0 issues

**Dependencies:** 8, 9, 10

**Files likely touched:** none (dashboard)

**Estimated scope:** M

---

### CHECKPOINT C — backend live
- [ ] Backend reachable at `*.onrender.com`; `/admin/` styled
- [ ] Auth: prod Clerk token → 200; no token → 401
- [ ] Headers: HTTPS redirect + HSTS; `Access-Control-Allow-Origin` specific, not `*`

---

## Task 12: Frontend prod env wiring + `.env.example` + build gates

**Description:** Add `frontend/.env.example` with `EXPO_PUBLIC_API_BASE_URL` and
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Confirm `client.ts` already consumes
`EXPO_PUBLIC_API_BASE_URL` (it does) and that `ClerkProvider` reads the
publishable key from env (add `publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}`
explicitly if not already). No hardcoded hosts.

**Acceptance criteria:**
- [ ] `frontend/.env.example` documents both vars (no values)
- [ ] `ClerkProvider` uses the env publishable key
- [ ] `grep` shows no hardcoded backend URL or Clerk key in `frontend/src` or `frontend/app`
- [ ] `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web` all pass

**Verification:**
- [ ] `cd frontend && npx tsc --noEmit` → clean
- [ ] `cd frontend && npm run lint` → clean
- [ ] `cd frontend && npx expo export --platform web` → `dist/` produced, no errors
- [ ] `npx serve frontend/dist` locally with `EXPO_PUBLIC_API_BASE_URL` pointing at the Render backend → app loads, sign-in screen renders

**Dependencies:** 11

**Files likely touched:**
- `frontend/.env.example`
- `frontend/app/_layout.tsx`
- `frontend/.gitignore` (ensure `dist/` ignored — already is)

**Estimated scope:** S

---

## Task 13: [operator] Deploy frontend static site on Render

**Description:** In the Render Blueprint, set the static site's env vars:
`EXPO_PUBLIC_API_BASE_URL` = the backend Render URL, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
= Task 10 prod key. Trigger a build. Then add the static-site origin to the
backend's `CORS_ALLOWED_ORIGINS` / `DJANGO_CSRF_TRUSTED_ORIGINS` and to Clerk's
allowed origins; redeploy backend.

**Acceptance criteria:**
- [ ] Static site builds and serves at its `*.onrender.com` URL
- [ ] Page loads; no CORS errors in browser console on API calls
- [ ] Backend CORS/CSRF now list the frontend origin (not wildcard)
- [ ] Clerk prod instance lists the frontend origin as allowed

**Verification:**
- [ ] Open the frontend URL in a fresh browser → app renders, no console CORS/network errors
- [ ] `curl -sI -H "Origin: https://<frontend>.onrender.com" https://<backend>.onrender.com/api/videoessays/` → `Access-Control-Allow-Origin` echoes that specific origin

**Dependencies:** 12

**Files likely touched:** none (dashboard); possibly re-set backend env vars

**Estimated scope:** S

---

## Task 14: End-to-end acceptance against deployed URLs

**Description:** Run the manual acceptance checklist from `SPEC.md` Testing
Strategy against the live URLs. Fix blockers found (scope permitting) or log them.

**Acceptance criteria:**
- [ ] Fresh sign-up via Clerk **prod** completes on the deployed web app
- [ ] Search → log → review → view-by-video flow works
- [ ] Profile shows the new log; list/watchlist add works
- [ ] Reload / new session persists data (Postgres confirmed)
- [ ] Unauthenticated protected endpoint → 401; valid token → 200
- [ ] No `Access-Control-Allow-Origin: *`; HTTPS redirect + HSTS present
- [ ] `error.md` `'(home)'` navigator issue does not break routing on the built site

**Verification:**
- [ ] Each `SPEC.md` Success Criteria checkbox ticked
- [ ] Screenshot / note of the completed flow saved

**Dependencies:** 11, 13

**Files likely touched:** none (or small bug fixes if found)

**Estimated scope:** M

---

## Task 15: Write `DEPLOY.md` runbook

**Description:** Step-by-step: prerequisites, Render Blueprint setup, every
dashboard env var and where its value comes from, Clerk prod setup, superuser
creation, redeploy steps, rollback (Render "Rollback" + how to revert
`render.yaml`), and known free-tier caveats (cold start, 90-day Postgres,
SerpAPI quota, backup note).

**Acceptance criteria:**
- [ ] A reader can rebuild the whole deployment from scratch using only `DEPLOY.md`
- [ ] Every env var from both `.env.example` files is listed with its source
- [ ] Rollback procedure documented
- [ ] Free-tier caveats + secret-rotation note included

**Verification:**
- [ ] Cross-check every `render.yaml` `sync: false` var appears in `DEPLOY.md`
- [ ] Human read-through

**Dependencies:** 14

**Files likely touched:**
- `DEPLOY.md`

**Estimated scope:** S

---

## Task 16: Merge `v2` → `main`

**Description:** Once beta is verified live, merge `v2` into `main`. Point Render
Blueprint auto-deploy at `main`.

**Acceptance criteria:**
- [ ] `v2` merged to `main` (no force-push, no history rewrite)
- [ ] Render deploys from `main` and stays green
- [ ] `SPEC.md`, `tasks/`, `DEPLOY.md` all on `main`

**Verification:**
- [ ] `git log main -1` shows the merge; CI/Render build on `main` succeeds
- [ ] Deployed URLs still serve after the `main` deploy

**Dependencies:** 14

**Files likely touched:** none (git)

**Estimated scope:** S

---

### CHECKPOINT D — complete
- [ ] All `SPEC.md` Success Criteria met
- [ ] Full flow works on deployed web URL, data persists
- [ ] `DEPLOY.md` accurate; `v2` merged to `main`; ready to invite testers
