# Video Essay Log

A Letterboxd-style app for video essays. Search YouTube for video essays, log and
review them, build a watchlist and custom lists, and follow other users.

One Expo / React Native codebase targets web, iOS, and Android, backed by a
Django REST API. Currently deployed to Render as a closed beta.

- Backend: https://videoessay-backend.onrender.com
- Frontend: https://videoessay-web.onrender.com

## Stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Frontend | Expo, React Native, expo-router, NativeWind                       |
| Backend  | Django, Django REST Framework, gunicorn, WhiteNoise               |
| Auth     | [Clerk](https://clerk.com) (JWT verified against Clerk's JWKS)    |
| Database | Postgres on Supabase in production, SQLite locally                |
| Search   | [SerpAPI](https://serpapi.com) for YouTube, with DB-only fallback |
| Hosting  | Render (Blueprint in `render.yaml`)                               |

## Repo layout

```
backend/    Django project (config/, movie_csv/ core app, users/ profiles)
frontend/   Expo app (app/ routes, src/ screens + API client)
tasks/      Plans and todo lists for past and in-flight work
SPEC*.md    Feature and deployment specs
DEPLOY.md   Render + Supabase + Clerk deployment runbook
CLAUDE.md   Architecture notes and conventions (also useful for humans)
```

## Running locally

You need Python 3, Node, and a Clerk application (dev instance is fine).

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in values
python manage.py migrate
python manage.py runserver
```

With no `DATABASE_URL` set, the backend uses a local SQLite file.

| Variable                                | Purpose                                            |
| --------------------------------------- | -------------------------------------------------- |
| `CLERK_ISSUER`                          | Your Clerk issuer URL (required in production)     |
| `SERPAPI_KEY`                           | YouTube search; without it search returns 503 and the app falls back to DB results |
| `DATABASE_URL`                          | Postgres connection string (production)            |
| `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS` | Standard Django / CORS config |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # then fill in values
npx expo start              # press w for web, or scan the QR code for a device
```

| Variable                            | Purpose                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (required)                               |
| `EXPO_PUBLIC_API_BASE_URL`          | Backend URL. Optional in dev (auto-discovered); required for web builds |

## Checks

```bash
# backend (from backend/)
python manage.py test
python manage.py check --deploy

# frontend (from frontend/)
npx tsc --noEmit
npm run lint
npm test
npx expo export --platform web
```

## Deploying

Pushing the deploy branch triggers Render to build from `render.yaml`
(backend web service plus frontend static site). The database lives in Supabase
and `DATABASE_URL` is set by hand in the Render dashboard. See
[DEPLOY.md](DEPLOY.md) for the full runbook and [SPEC.md](SPEC.md) for the
environment variable list.

## Roadmap

In-flight work is tracked in [tasks/todo.md](tasks/todo.md) and
[tasks/plan.md](tasks/plan.md).
