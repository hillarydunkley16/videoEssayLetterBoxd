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

## Task 7: Clerk config to env; JWKS cache TTL; logging not `print`  ✅ DONE

**Description:** In `authentication.py` and `settings.py`: read `CLERK_ISSUER`
from env (dev default only when `DEBUG`), derive `CLERK_JWKS_URL` from it. Give
the JWKS cache a timestamp + TTL (e.g. 10 min) instead of caching forever.
Optionally accept a second issuer via `CLERK_ISSUER_LEGACY` to bridge the
dev→prod cutover. Replace `print(...)` with `logging.getLogger(__name__)`.

**Acceptance criteria:**
- [x] `authentication.py` reads issuer/JWKS from `settings`; no hardcoded issuer,
      no `print` (grep-guarded by a test)
- [x] JWKS cached within `settings.CLERK_JWKS_CACHE_TTL` (default 600s), refetched
      after — verified by mocked-clock tests
- [x] No / non-Bearer `Authorization` header → `None` (unchanged)
- [x] Malformed token → `AuthenticationFailed` (unchanged)
- [x] `jwt.decode` gets a tuple of `(CLERK_ISSUER, CLERK_ISSUER_LEGACY)` so
      dev+prod tokens both verify during cutover

**Verification:**
- [x] `movie_csv/test_authentication.py` — 9 tests, all pass; full suite 27/27
- [x] `grep -n "print(" .../authentication.py` → empty
- [x] `grep -n "splendid-sunbird" .../authentication.py` → empty
- [x] `check` clean, no drift; DRF `/api/logList/` → 403 for no-header and
      bad-bearer (unchanged)
- Committed as `3480730`. Settings reads landed in Task 5 (`5c4cc73`).

**Behavior change (deliberate, tested):** a persistent unknown-`kid` now raises
`AuthenticationFailed` before `jwt.decode` instead of calling decode with a
`None` key. Net auth result is identical (still 403).

**Note:** `views/api.py` still has ~50 debug `print()`s (incl. the module-level
`print(permission_classes)` that noises up test output). Out of scope here;
fold into Task 14 / a code-review pass.

**Dependencies:** 5

**Estimated scope:** S

---

## Task 8: Backend smoke tests + `.env.example` + `runtime.txt`  ✅ DONE

**Description:** Add the smoke tests from `SPEC.md` Testing Strategy. Add
`backend/.env.example` (names only, no values) and `backend/runtime.txt`
(`python-3.13.x`).

**Acceptance criteria:**
- [x] Suite covers: `check --deploy` clean under prod env (Task 5);
      `ClerkAuthentication` none/malformed/valid with mocked JWKS (Task 7);
      protected list endpoints (`logList`, `userLogs`, `collections/user/`)
      reject anonymous + serve an authed user (Task 8)
- [x] `VideoEssays` / `collections/` list = `AllowAny` today → tests lock in
      that contract + it's flagged for the security pass (not 401)
- [x] `backend/.env.example` documents every var read: `DJANGO_DEBUG`,
      `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`,
      `DJANGO_SECURE_SSL_REDIRECT`, `DJANGO_SECURE_HSTS_SECONDS`,
      `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, `CLERK_ISSUER`,
      `CLERK_ISSUER_LEGACY`, `CLERK_JWKS_CACHE_TTL`, `SERPAPI_KEY` — no values;
      a test asserts each name is actually read in source and no real secret leaks
- [x] `backend/runtime.txt` → `python-3.13.7`

**Verification:**
- [x] `manage.py test` → 40/40
- [x] `makemigrations --check --dry-run` → clean
- [x] `.env.example` completeness test green (`env="DATABASE_URL"` +
      `CLERK_JWKS_CACHE_TTL` env read added to settings so every name resolves)
- `.env.example` created by the user (agent tools blocked by the `.env*` deny
  rule); content dictated verbatim by the agent. Committed as `46ea62f`.

**Note:** DRF `UnorderedObjectListWarning` on `Log`/`Collection` pagination
(models lack `Meta.ordering`) — pre-existing, surfaced by the new tests; fold
into the code-review/security pass.

**Dependencies:** 6, 7

**Estimated scope:** M

---

### CHECKPOINT B — review with human before Render provisioning
- [x] Prod env + `DJANGO_DEBUG` unset → `check --deploy --fail-level WARNING` 0 issues, exit 0
- [x] No env vars → local dev works: `DEBUG=True`, SQLite, `ALLOWED_HOSTS=['*']`
- [x] `manage.py test` → 40/40; `makemigrations --check` → no drift
- [x] `collectstatic --noinput` → success (429 files post-processed / hashed)
- [ ] **Human review of the backend hardening before Task 9 (render.yaml) + Task 11 (provision)**

---

## Task 9: Add `render.yaml` Blueprint  ✅ DONE

**Description:** Repo-root `render.yaml` defining a Python web service (backend),
a static site (frontend web), and a free PostgreSQL instance, with env-var
wiring.

**Acceptance criteria:**
- [x] Web service: `rootDir: backend`, build
      `pip install -r requirements.txt && manage.py collectstatic --noinput`,
      start `manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
      (migrate moved out of `preDeployCommand` — paid-only on Render)
- [x] Static site: `rootDir: frontend`, build
      `npm ci --legacy-peer-deps && npx expo export --platform web`,
      `staticPublishPath: dist`, SPA rewrite `/* -> /index.html`, `NODE_VERSION` pinned
- [x] `DJANGO_DEBUG: "false"`; `DJANGO_SECRET_KEY` `generateValue`; `DATABASE_URL`
      `fromDatabase`; hosts/CORS/CSRF + Clerk + SerpAPI + `EXPO_PUBLIC_*` all
      `sync: false` (operator-set). No secrets committed.
- [x] Postgres `plan: free`; all three resources free
- [x] `settings.py` auto-trusts `RENDER_EXTERNAL_HOSTNAME` (ALLOWED_HOSTS + CSRF)
      so first deploy works before `DJANGO_ALLOWED_HOSTS` is set
- [x] `frontend/.npmrc` → `legacy-peer-deps=true`

**Verification:**
- [x] Schema checked against render.com/docs/blueprint-spec; free-tier preDeploy
      limitation against render.com/docs/deploys
- [x] `movie_csv/test_render_blueprint.py` (9) content-guards the file; suite 50/50
- [ ] Render Blueprint preview (3 resources) — happens at Task 11
- Committed as `90da6b2`.

**To verify at deploy (Task 11/13):** exact `NODE_VERSION` availability on Render;
`npm ci` lockfile sync (fall back to `npm install` if it errors); `expo export`
output dir is `dist/`.

**Dependencies:** 6, 7

**Estimated scope:** S

---

## Task 10: [operator] Confirm Clerk dev instance + capture its keys  ✅ DONE

**Decision (changed):** Clerk *production* needs a custom domain with DNS control;
the `*.onrender.com` beta has none. Use the existing **development** instance for
the closed beta; create the prod instance before public launch (SPEC Open Q2).

**Captured values (for Tasks 11 & 13 — set as Render env vars, not committed):**
- `CLERK_ISSUER` = `https://splendid-sunbird-55.clerk.accounts.dev`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_c3BsZW5kaWQ…ZXYk` (public by
  design — ships in the web bundle; full value in `frontend/.env` and provided
  by the user)
- `CLERK_ISSUER_LEGACY` — leave unset for the beta (no cutover)

**Acceptance criteria:**
- [x] Dev instance confirmed: `splendid-sunbird-55.clerk.accounts.dev`
- [x] Issuer + publishable key captured
- [x] Email/password sign-in — user confirmed enabled

**Verification:**
- [x] `https://splendid-sunbird-55.clerk.accounts.dev/.well-known/jwks.json` →
      `keys` array with `kid=ins_38qOjACFHMWQO5uAI7AWm2Bv9bH` (kty/n/e present)
      — checked via WebFetch

**Adding the deployed web origin to Clerk's allowed origins** happens in Task 13,
once Render has assigned `videoessay-web.onrender.com`.

**Dependencies:** None

**Files likely touched:** none (dashboard + secrets)

**Estimated scope:** S

---

## Task 11: [operator] Provision backend + Postgres on Render, run migrations  ✅ DONE

**Backend live at:** `https://videoessay-backend.onrender.com`

**Deploy failures fixed en route (3 pushes):**
1. `origin/v2` had a stray `46c72cd Delete .env` → rebased local `v2` onto it +
   pushed (rebase rewrote local SHAs; pre-Task-11 SHA refs in this file are stale).
2. `collectstatic` in `buildCommand` imported settings → `RuntimeError` on unset
   `CLERK_ISSUER` (sync:false vars absent at build). Moved `migrate` +
   `collectstatic` into `startCommand`. Also Render ignored `runtime.txt` and
   used Python 3.14 → pinned `PYTHON_VERSION="3.13.7"`.
3. `CLERK_ISSUER` still blank at runtime (never set in dashboard) → made it a
   literal `value:` in render.yaml (dev-instance issuer is a public URL).

**Acceptance criteria:**
- [x] Build + deploy → "live" on Python 3.13.7
- [x] `startCommand` migrate ran (API returns real Postgres data, not a 500)
- [x] `GET /admin/login/` → Django login form; `/static/admin/css/base.css` → CSS body (WhiteNoise serving)
- [x] `GET /api/VideoEssays/` → `200 {"count":0,"results":[]}` (DB reachable)
- [x] `GET /api/logList/` → `403` (auth enforced)
- [ ] Superuser created + `/admin/` login — **user to confirm** (Shell tab →
      `python manage.py createsuperuser`)

**Verified via WebFetch** (curl is sandboxed for the agent).

**Not yet checked:** `Strict-Transport-Security` header + non-wildcard CORS
(WebFetch strips headers) — confirm at Task 14 against the live web app.

**Dependencies:** 8, 9, 10

**Estimated scope:** M

---

### CHECKPOINT C — backend live  ✅ (headers + token-auth deferred to Task 14)
- [x] Backend reachable at `https://videoessay-backend.onrender.com`; `/admin/` renders, CSS serves
- [x] Auth: no token → 403 on `/api/logList/`. Clerk-token → 200 verified end-to-end at Task 14 (live web app)
- [ ] Headers: HSTS + non-wildcard CORS — check at Task 14 (WebFetch can't see headers)

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
