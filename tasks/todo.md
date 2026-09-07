# Deploy to Closed Beta — Task List

Plan: `tasks/plan.md`. Spec: `SPEC.md`. Branch: `v2` (merges to `main` at Task 16).
Do tasks in order. `[operator]` tasks are done by the user in a web console with
the agent supplying exact steps/values and verifying the result.

---

## Task 1: Commit current `v2` working tree  ✅ DONE

**Description:** `v2` has ~2000 uncommitted lines mixing feature work and earlier
deploy prep. Commit it as-is so all subsequent deployment changes land in
isolated, reviewable commits.

**Acceptance criteria:**
- [x] `git status` is clean except for intentionally-untracked files
      (`.env`, `db.sqlite3`, `.pyc`, `.DS_Store`, migrations 0006–0008 — all
      deferred to Tasks 2/3)
- [x] `.pyc` / `.DS_Store` are NOT part of this commit
- [x] Commit message describes the bundled state honestly

**Verification:**
- [x] `git log -1 --stat` shows the expected files (2 commits: d9389ff feature
      snapshot, 0044c00 spec+plan)
- [x] `python manage.py check` passes — "System check identified no issues"
- [~] `runserver` boot: not run (harness blocks backgrounded server + sleep);
      `check` passing covers app import/config

**Notes:**
- Local dev venv is `/Users/hillarydunkley/myworld` (shared home-dir venv), which
  has **Django 5.2.10** and many unrelated packages. `backend/requirements.txt`
  pinned **Django 4.2.26** and had never actually been installed anywhere.
- **Decision:** target **Django 5.2 LTS** in a dedicated `backend/.venv`. See Task 1b.

**Dependencies:** None

**Files likely touched:** (git only — no content changes)

**Estimated scope:** S

---

## Task 1b: Create project virtualenv + rebuild `requirements.txt` (Django 5.2 LTS)  ✅ DONE

**Description:** The old `requirements.txt` (Django 4.2.26, psycopg3, gunicorn,
etc.) was written speculatively and never installed/verified. Create a dedicated
`backend/.venv`, install a corrected dependency set on the **Django 5.2 LTS**
line, verify the app, and freeze the exact working set into `requirements.txt` so
local == Render. Runs before Task 3 (migration verification needs a real env).

**Acceptance criteria:**
- [x] `backend/.venv` exists and is gitignored (Python 3.13.7)
- [x] `requirements.txt` contains only this project's deps, pinned; installs
      cleanly on Python 3.13 + Django 5.2.10 (`pip check` clean)
- [x] Prod-serving deps present: `gunicorn`, `whitenoise`, `dj-database-url`,
      `psycopg[binary]`
- [x] `python manage.py check` passes in `backend/.venv` — 0 issues
- [x] Migration graph builds + runs without error; `makemigrations --check` → no drift
- [x] SerpAPI reconciled: code uses `from serpapi import GoogleSearch` →
      pinned `google-search-results==2.4.2` (the `serpapi.Client` path is dead
      commented code)

**Verification:**
- [x] `backend/.venv/bin/python -m django --version` → 5.2.10
- [x] `backend/.venv/bin/python manage.py check` → "no issues (0 silenced)"
- [x] `backend/.venv/bin/python -m pip check` → "No broken requirements found"
- [x] `requirements.txt` holds 13 project deps only, no unrelated packages

**Absorbed scope (decision: unmount legacy web UI):**
- Removed `bootstrap5` / `star_ratings` / `crispy_forms` / `crispy_bootstrap5`
  from `INSTALLED_APPS` + `requirements.txt`; removed `CRISPY_TEMPLATE_PACK`.
  Root cause: `django-bootstrap-v5==1.0.11` requires `python <4.0` + `django <5.0`.
- `movie_csv/urls/__init__.py` now mounts `/api/` only (dropped `movie_csv.urls.web`).
- `config/urls.py` dropped `users.urls` (template login/register/profile).
- `LOGIN_REDIRECT_URL` / `LOGOUT_REDIRECT_URL` / `LOGIN_URL` repointed to `/admin/`.
- Legacy `views/web.py`, `urls/web.py`, `movie_csv/templates/`, `users/templates/`,
  `forms.py` remain on disk, unrouted → **Task 4 can now delete them cleanly.**
- Committed as `ac2564e`.

**Notes:**
- `requirements.txt` pins direct deps only (no full transitive lockfile). Fine for
  closed beta; revisit (pip-tools / uv lock) before public launch.
- Stray `print([...IsAuthenticated])` at import time in `views/api.py` — harmless
  noise, clean up when Task 7 touches that area.

**Dependencies:** 1

**Files touched:** `backend/requirements.txt`, `backend/config/settings.py`,
`backend/config/urls.py`, `backend/movie_csv/urls/__init__.py`, `.gitignore`

**Estimated scope:** M

---

## Task 2: Repo hygiene — untrack secrets/artifacts, fix `.gitignore`  ✅ DONE

**Description:** Stop tracking `.env` files, `db.sqlite3`, `__pycache__`/`*.pyc`,
and `.DS_Store`. Add root `.env.example` placeholders are handled in Tasks 8/12;
here just remove and ignore.

**Acceptance criteria:**
- [x] `.gitignore` (root) covers: `.env` + `.env.*` (keep `*.env.example`),
      `__pycache__/`, `*.py[cod]`, `.venv/`/`venv/`, `*.sqlite3`, `.DS_Store`
- [x] `git rm --cached`: `.env`, `db.sqlite3` (root), `backend/db.sqlite3`,
      3× `.DS_Store`, 71× tracked `*.pyc` under `backend/**/__pycache__`
- [x] Local files remain on disk (`.env` 139 B, `backend/db.sqlite3` 377 KB present)
- [x] `git ls-files` returns none of the above patterns

**Verification:**
- [x] `git ls-files | grep -E '\.env$|\.sqlite3$|\.pyc$|\.DS_Store$|__pycache__'` → empty
- [x] `manage.py check` → 0 issues (SQLite intact); `git check-ignore` confirms
      `backend/.env.example` is NOT ignored (negation works)
- Committed as `fc5734e`.

**Note:** `.env` secrets are in git history; SERPAPI_KEY rotation tracked at Task 11.

**Dependencies:** 1

**Files likely touched:**
- `.gitignore`
- `frontend/.gitignore` (verify it already covers `.env`; it does)

**Estimated scope:** S

---

## Task 3: Commit migrations 0006–0008, verify no model drift  ✅ DONE

**Description:** Migrations `0006_collection`, `0007_alter_log_rating`,
`0008_collection_is_watchlist` exist on disk but are untracked. Commit them and
confirm models and migrations agree.

**Acceptance criteria:**
- [x] The three migration files are tracked and committed (committed `344a764`)
- [x] `makemigrations --check --dry-run` → "No changes detected", exit 0
- [x] Full `migrate` on a brand-new SQLite DB applies all 40+ migrations
      (incl. movie_csv 0006/0007/0008) → exit 0

**Verification:**
- [x] `.venv/bin/python manage.py makemigrations --check --dry-run` → exit 0
- [x] `manage.py migrate --settings=<override pointing at a fresh tempfile DB>`
      → every migration `OK`, non-destructive to `backend/db.sqlite3`
- Migration chain is linear 0005→0006→0007→0008, Django 5.2.10-generated.
- 0007 carries a 0-10→0-5 rating data migration with `RunPython.noop` reverse
  (reverse loses data — acceptable, documented).

**Dependencies:** 1

**Files likely touched:**
- `backend/movie_csv/migrations/0006_collection.py`
- `backend/movie_csv/migrations/0007_alter_log_rating.py`
- `backend/movie_csv/migrations/0008_collection_is_watchlist.py`

**Estimated scope:** S

---

## Task 4: Delete root-level pre-restructure cruft  ✅ DONE

**Description:** Remove leftovers from before the `backend/` restructure:
`/main.py`, `/movie_csv/` (has its own `urls.py`), `/media/`, root `/db.sqlite3`,
root `/package.json` + `/package-lock.json`. Confirmed: nothing under `backend/`
or `frontend/` imports these; `backend/movie_csv/` is the live app.
**Also** (now unrouted after Task 1b — safe to delete): `backend/movie_csv/views/web.py`,
`backend/movie_csv/urls/web.py`, `backend/movie_csv/forms.py`,
`backend/movie_csv/templates/`, `backend/users/views.py` (template views),
`backend/users/urls.py`, `backend/users/forms.py`, `backend/users/templates/`,
`backend/movie_csv/services/serpapi_youtube.py` (dead `serpapi.Client` path).
Keep `backend/users/models.py`, `signals.py`, `admin.py`, `serializers.py`.

**Acceptance criteria:**
- [x] Live code (`config/`, `movie_csv/views/api.py`, `urls/api.py`,
      `serializers.py`, `users/models.py|signals.py|admin.py|serializers.py`)
      references none of the deleted paths — verified by grep + import trace
- [x] 29 files `git rm`'d and committed (`e9f190b`)
- [x] `manage.py check` → 0 issues; `makemigrations --check` → no drift

**Verification:**
- [x] grep for `views.web` / `urls.web` / `.forms import` / `serpapi_youtube` /
      `users.views` / `users.urls` / `templates/*` in `*.py` → only two stale
      explanatory comments in `urls/__init__.py` + `config/urls.py` (kept)
- [x] `manage.py check` boots the app (URLconf + all apps load)
- [~] `frontend tsc`: not run — frontend untouched; root `package.json` was
      unrelated to `frontend/` (which has its own)

**Deleted:**
- Repo root: `main.py`, `package.json`, `package-lock.json`, `media/`
  (1 orphan JPG — MEDIA_ROOT is `backend/media`), `movie_csv/` (stale url stubs)
- `backend/` legacy web UI (unrouted since Task 1b): `movie_csv/views/web.py`,
  `movie_csv/urls/web.py`, `movie_csv/forms.py`, `movie_csv/templates/` (11 html),
  `movie_csv/services/serpapi_youtube.py`, `users/views.py`, `users/urls.py`,
  `users/forms.py`, `users/templates/` (3 html), `backend/package-lock.json` (empty stub)
- **Kept:** `backend/users/{models,signals,admin,serializers,apps}.py`, migrations,
  `movie_csv/static/css/mystyles.css` (STATICFILES_DIRS target — revisit at Task 6)

**Note:** untracked leftovers still on disk (all gitignored, harmless, `rm` was
permission-blocked): stale root `db.sqlite3` (217 KB, Jan 2026 — NOT the live
`backend/db.sqlite3`), some `.DS_Store`. Clean up manually with
`rm -f db.sqlite3 .DS_Store backend/.DS_Store` if desired.

**Dependencies:** 2

**Estimated scope:** S

---

### CHECKPOINT A — reviewed ✅
- [x] `git ls-files` clean of secrets/artifacts
- [x] Local dev unchanged: `check` passes, admin + API serve, legacy routes 404
- [x] Root cruft removed from git (gitignored disk leftovers noted above)
- User instructed "continue" via repeated `/build`.

---

## Task 5: Env-driven `settings.py` — debug/secret/hosts/CORS/security  ✅ DONE

**Description:** Replace hardcoded dev values with environment reads plus safe
local defaults, per the Code Style snippet in `SPEC.md`. Covers `DEBUG`,
`SECRET_KEY` (raise if missing when not debug), `ALLOWED_HOSTS`,
`CSRF_TRUSTED_ORIGINS`, CORS allowlist (no wildcard when not debug), and the
production security block (SSL redirect, proxy header, secure cookies, HSTS).

**Acceptance criteria:**
- [x] No `SECRET_KEY` / host / origin literal in `settings.py` — dev fallbacks
      for `SECRET_KEY` and `CLERK_ISSUER` only, both `DEBUG`-gated
- [x] `CLERK_ISSUER` / `CLERK_JWKS_URL` / `CLERK_ISSUER_LEGACY` from env
      (authentication.py wiring is Task 7)
- [x] Prod env, `DJANGO_DEBUG` unset: `check --deploy --fail-level WARNING`
      → "no issues", exit 0 (`DJANGO_SECRET_KEY` presence flips `DEBUG` off)
- [x] No env: `DEBUG=True`, SQLite, `CORS_ALLOW_ALL_ORIGINS=True`, request smoke OK
- [x] `MIDDLEWARE` de-duplicated; `OTPMiddleware` kept; WhiteNoise slot marked for Task 6
- [x] No dangling `CRISPY_*` / `STAR_RATINGS_*` refs

**Verification:**
- [x] `movie_csv/tests.py` — 12 subprocess tests (RED 9→GREEN 0), full suite 12/12
- [x] `manage.py check` (no env) → 0 issues
- [x] `check --deploy` with `DJANGO_SECRET_KEY`/`DJANGO_ALLOWED_HOSTS`/`CLERK_ISSUER`
      → 0 issues, exit 0
- [x] `makemigrations --check` → no drift; dev-mode `/admin/` + `/api/` smoke unchanged
- Committed as `5c4cc73`.

**Design note:** `DEBUG` defaults to `not bool($DJANGO_SECRET_KEY)` when
`DJANGO_DEBUG` is unset — so `check --deploy` is clean without needing an
explicit `DJANGO_DEBUG=false`, while `no env at all` still yields dev mode.
HSTS defaults 3600s + subdomains + preload (inert without hstspreload.org
submission; needed for a clean `--deploy`); override via `DJANGO_SECURE_HSTS_SECONDS`.

**Dependencies:** 3

**Files likely touched:**
- `backend/config/settings.py`

**Estimated scope:** M

---

## Task 6: Database via `dj-database-url` + WhiteNoise static pipeline  ✅ DONE

**Description:** Wire `dj_database_url.config()` with a SQLite fallback for the
`default` database. Add WhiteNoise: middleware directly after
`SecurityMiddleware`, `STATIC_ROOT = BASE_DIR / "staticfiles"`, and
`STORAGES["staticfiles"]` set to WhiteNoise compressed manifest storage.

**Acceptance criteria:**
- [x] `DATABASE_URL=postgres://…` → `ENGINE=django.db.backends.postgresql`,
      `CONN_MAX_AGE=600`; unset → SQLite file
- [x] `collectstatic --noinput --clear` exits 0 and writes
      `backend/staticfiles/staticfiles.json`
- [x] `staticfiles/` gitignored
- [x] WhiteNoise serves the hashed admin CSS: `200`, `text/css`,
      `Cache-Control: max-age=315360000, public, immutable` (verified via
      test client over https; plain http 301s due to the Task 5 SSL redirect)

**Verification:**
- [x] `movie_csv/tests.py` +6 (suite 18/18): postgres selection, `CONN_MAX_AGE`,
      middleware adjacency, `STATIC_ROOT`, whitenoise storage backend,
      collectstatic → manifest
- [x] `check --deploy --fail-level WARNING` still 0 issues with `DATABASE_URL` set
- [x] `makemigrations --check` → no drift
- Committed as `b69fa5c`.

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
