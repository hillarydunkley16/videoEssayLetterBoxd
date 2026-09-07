# Spec: Deploy "Bootleg Letterboxd for Video Essays" to Closed Beta

## Objective

Get the existing app to a live, publicly reachable **closed beta / soft launch**:

- The Django/DRF backend runs as a hosted API on **Render** (Render Web Service +
  Render PostgreSQL), configured for production (no `DEBUG`, secrets from env,
  locked-down hosts/CORS).
- The Expo frontend is built as a **static web bundle** and hosted at a stable
  public URL (Render Static Site), pointed at the deployed backend.
- Auth runs on a **Clerk production instance** (not the current dev instance),
  with the backend verifying prod-issuer tokens and the frontend using the prod
  publishable key.
- A small group of invited testers can sign up, log a video essay, review it,
  view profiles, and use lists/watchlists against real hosted infrastructure.

**Users:** the developer (deploy/operate) and a handful of invited beta testers
on the web app.

**Success looks like:** an invited tester opens the web URL on a fresh device,
signs up via Clerk, completes the search → log → review → view-by-video flow, and
the data persists in Render Postgres. `manage.py check --deploy` reports no
issues. No secrets in the git repo or the client bundle.

**Explicitly out of scope for this launch:** native iOS/Android builds and store
submission, staging environment, full automated test coverage, CI gating,
load/scale work, advanced observability/alerting. (Tracked in Open Questions for a
later public launch.)

## Tech Stack

| Layer | Choice |
|---|---|
| Backend framework | Django 4.2.26, Django REST Framework 3.17.1 |
| Backend runtime | Python 3.13, gunicorn 26.0.0 |
| Static file serving | WhiteNoise 6.12.0 (admin + DRF browsable API only) |
| DB (prod) | Render PostgreSQL via `dj-database-url` 3.1.2 + `psycopg[binary]` 3.3.4 |
| DB (local dev) | SQLite (unchanged) |
| Auth | Clerk (production instance) — JWT verified with `python-jose` |
| External API | SerpAPI (`google-search-results`) for YouTube search |
| Frontend | Expo SDK 54, React Native 0.81, expo-router 6, React 19 |
| Frontend auth | `@clerk/clerk-expo` 2.x |
| Frontend host | Render Static Site serving `expo export` web output |
| Backend host | Render Web Service (Python environment) |
| Infra as code | `render.yaml` blueprint at repo root |

## Commands

### Backend (run from `backend/`)

```
Install:          pip install -r requirements.txt
Dev server:       python manage.py runserver
Migrate:          python manage.py migrate
Make migrations:  python manage.py makemigrations
Deploy check:     python manage.py check --deploy
Collect static:   python manage.py collectstatic --noinput
Create admin:     python manage.py createsuperuser
Test:             python manage.py test
Prod serve:       gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

### Frontend (run from `frontend/`)

```
Install:          npm install
Dev:              npx expo start
Lint:             npm run lint
Typecheck:        npx tsc --noEmit
Web build:        npx expo export --platform web        # outputs to frontend/dist/
Preview build:    npx serve dist
```

### Render (Blueprint deploy)

```
Deploy:           push to the deploy branch; Render auto-builds from render.yaml
Backend build:    pip install -r backend/requirements.txt
Backend release:  python backend/manage.py migrate
Backend start:    cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
Frontend build:   cd frontend && npm ci && npx expo export --platform web
Frontend publish: frontend/dist
```

## Project Structure

Current layout (relevant parts):

```
backend/
  config/            → Django project: settings.py, urls.py, wsgi.py, asgi.py
  movie_csv/         → Core app: VideoEssay, Log, Like, Comment, Collection
    authentication.py → ClerkAuthentication (JWT verify against Clerk JWKS)
    views/api.py     → DRF viewsets + SerpAPI search
    services/        → serpapi_youtube.py, youtube_search.py
    migrations/      → 0001–0008 (0006–0008 currently untracked)
  users/             → Profile model, followers/following, signals
  requirements.txt   → app deps + prod-serving deps (gunicorn/whitenoise/dj-database-url/psycopg)
  db.sqlite3         → local dev DB (to be untracked)
frontend/
  app/               → expo-router routes ((auth), (home), (tabs), (modals))
  src/api/client.ts  → API base URL resolution (EXPO_PUBLIC_API_BASE_URL aware)
  src/screens/       → screen components
  app.json           → Expo config
```

Files to **add** in this effort:

```
render.yaml                  → Render Blueprint: web service + static site + Postgres
backend/config/settings.py   → (modified) env-driven production config
backend/.env.example         → documents required backend env vars (no values)
backend/runtime.txt          → pins Python version for Render (python-3.13.x)
frontend/.env.example        → documents EXPO_PUBLIC_* vars (no values)
DEPLOY.md                    → step-by-step runbook (Render setup, Clerk prod, DNS, rollback)
```

Files/paths to **remove or untrack** (repo hygiene, see Boundaries):

```
/main.py, /movie_csv/, /media/, /db.sqlite3, /package.json, /package-lock.json   → pre-restructure cruft at repo root
backend/db.sqlite3                                                               → untrack, add to .gitignore
backend/**/__pycache__/*.pyc, .DS_Store                                          → untrack, add to .gitignore
.env (root), frontend/.env                                                       → untrack; keep only .env.example
```

## Code Style

Settings must read every environment-specific value from the environment with a
safe local default, and fail loudly in production when a required secret is
missing. One pattern, applied consistently:

```python
# backend/config/settings.py
import os
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

def env_bool(name, default="false"):
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes"}

DEBUG = env_bool("DJANGO_DEBUG")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-local-only"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DEBUG is off")

ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h]
CSRF_TRUSTED_ORIGINS = [o for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o]

CORS_ALLOWED_ORIGINS = [o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o]
CORS_ALLOW_ALL_ORIGINS = DEBUG  # never wildcard in production

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

CLERK_ISSUER = os.environ["CLERK_ISSUER"] if not DEBUG else os.environ.get(
    "CLERK_ISSUER", "https://splendid-sunbird-55.clerk.accounts.dev"
)

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 3600
```

Conventions:
- No secret, host, or origin literal in committed source. `CLERK_ISSUER` and
  `CLERK_JWKS_URL` come from settings, not hardcoded in `authentication.py`.
- `authentication.py` keeps its JWKS cache but adds a TTL (refresh at most once
  per N minutes) rather than caching forever or fetching every request.
- Remove `print(...)` debugging from `authentication.py`; use `logging.getLogger(__name__)`.
- Migrations are committed. Never edit an applied migration; add a new one.
- Frontend: backend URL only ever comes from `process.env.EXPO_PUBLIC_API_BASE_URL`
  (already wired in `client.ts`); no new hardcoded hosts.

## Testing Strategy

Bar for closed beta is **smoke coverage + deploy checks**, not full unit coverage.

**Backend** — Django test runner (`python manage.py test`), tests in
`backend/<app>/tests.py`:
- `settings` smoke: with production env vars set and `DJANGO_DEBUG` unset, Django
  imports, `check --deploy` returns zero issues.
- Auth: `ClerkAuthentication.authenticate` returns `None` for missing/blank
  header, raises `AuthenticationFailed` for a malformed token, and (mocked JWKS)
  creates/returns a user for a valid token.
- One API smoke test per core resource (`VideoEssay`, `Log`, `Collection`):
  authenticated GET list returns 200; unauthenticated returns 401.
- `python manage.py makemigrations --check --dry-run` passes (no model drift).

**Frontend** — no test framework added for this launch. Gates are:
- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npx expo export --platform web` completes with no errors.

**Manual acceptance (against the deployed URLs)** — the runbook in `DEPLOY.md`
lists these; all must pass before inviting testers:
1. Web URL loads; Clerk sign-up completes with a prod-instance account.
2. Search a video essay → log it → write a review → see it under that video.
3. Profile shows the new log; list/watchlist add works.
4. Reload / new browser session persists data (confirms Postgres, not ephemeral).
5. `curl` an authenticated endpoint with no token → 401; with a valid token → 200.
6. Backend response headers show HTTPS redirect + HSTS; no `Access-Control-Allow-Origin: *`.

## Boundaries

**Always:**
- Run `python manage.py check --deploy` and `python manage.py test` before deploying.
- Run `npx tsc --noEmit`, `npm run lint`, and a web export before deploying frontend.
- Read every value that differs between local and prod from an environment variable.
- Commit migrations alongside the model change that produced them.
- Keep `.env.example` files current when a new env var is introduced.
- Deploy from a dedicated branch; verify on Render before merging to `main`.

**Ask first:**
- Adding or upgrading any dependency (backend or frontend).
- Any model/schema change or new migration.
- Changing the Render service topology (adding services, plans, regions).
- Switching frontend host away from Render Static Site.
- Deleting the root-level cruft files (`main.py`, `/movie_csv`, `/media`, root
  `db.sqlite3`, root `package.json`) — confirm nothing references them first.
- Rotating or regenerating the Clerk instance / keys.
- Force-pushing or rewriting history on `v2` or `main`.

**Never:**
- Commit secrets, API keys, `.env` files, or `db.sqlite3` with real data.
- Ship with `DEBUG=True`, `ALLOWED_HOSTS=["*"]`, or `CORS_ALLOW_ALL_ORIGINS=True`
  in production.
- Leave the Clerk **dev** issuer as the only accepted issuer in production.
- Edit an already-applied migration in place.
- Commit `__pycache__/`, `.pyc`, or `.DS_Store` files.
- Point the frontend at a hardcoded backend URL.
- Disable or delete a failing test to make a deploy go through.

## Success Criteria

- [ ] `render.yaml` at repo root provisions: 1 web service (backend), 1 static
      site (frontend web), 1 PostgreSQL instance.
- [ ] Backend is reachable at its Render URL; `GET /admin/` loads with WhiteNoise-served CSS.
- [ ] `python manage.py check --deploy` reports **0 issues** with the production env.
- [ ] `git ls-files` shows no `.env`, no `db.sqlite3`, no `.pyc`, no `.DS_Store`;
      `.gitignore` covers all four.
- [ ] Grep of `backend/` source shows no hardcoded `SECRET_KEY`, Clerk issuer, or origin literal.
- [ ] Clerk **production** instance created; backend `CLERK_ISSUER` and frontend
      `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` both point at it; a fresh sign-up works end to end.
- [ ] Frontend web URL loads and completes the search → log → review → view flow
      against the deployed backend, data persisting across sessions.
- [ ] Unauthenticated request to a protected endpoint returns 401; authenticated returns 200.
- [ ] Response headers on the deployed backend show HTTPS redirect + HSTS and a
      specific (non-wildcard) `Access-Control-Allow-Origin`.
- [ ] `backend/.env.example`, `frontend/.env.example`, and `DEPLOY.md` exist and
      are accurate enough for a clean redeploy from scratch.
- [ ] `SERPAPI_KEY` set as a Render env var; video search works on the deployed backend.
- [ ] Migrations 0006–0008 committed; `makemigrations --check` is clean.

## Open Questions

1. **Media/uploads:** `Profile.imageUrl` is a URL (Clerk-hosted), and `MEDIA_ROOT`
   is local disk. Render web services have ephemeral disk. Is any user upload
   actually written to `MEDIA_ROOT` in the current code, or is all imagery
   external URLs? If uploads exist, we need object storage (S3/Cloudinary) — confirm.
2. **Custom domain:** use the default `*.onrender.com` URLs for beta, or set up a
   custom domain now? Affects `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` / Clerk
   allowed origins and CORS.
3. **Deploy branch:** deploy from `v2` (has ~2000 uncommitted lines) or merge to
   `main` first? Recommend: commit `v2`, deploy from `v2`, merge to `main` once green.
4. **Render plan:** free tier (backend spins down after inactivity, ~50s cold
   start; Postgres free tier expires after 90 days) vs. paid Starter. Acceptable
   for beta?
5. **`error.md` navigator bug** (`'(home)' route not handled`) — is this still
   reproducing on web? It's dev-only per the message, but confirm the web build
   doesn't hit it.
6. **SerpAPI quota:** free SerpAPI plan is ~100 searches/month. Enough for beta,
   or does search need caching / a fallback?
7. **Backups:** rely on Render's automated Postgres backups for beta, or also run
   a scheduled `pg_dump`?
8. **Later (public launch, not now):** CI gate, error monitoring (Sentry), rate
   limiting on auth/search endpoints, native app builds + store submission,
   staging environment.
```
