# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Bootleg Letterboxd for Video Essays" — users search for YouTube video essays, log/review them, build watchlists and lists, and follow other users. Django/DRF backend + Expo/React Native frontend (targets web, iOS, Android from one codebase), deploying to Render for a closed beta. See `SPEC.md` for the full deployment spec and `tasks/todo.md` / `tasks/plan.md` for in-flight work and feature history.

## Commands

### Backend (run from `backend/`)

```
pip install -r requirements.txt      # install
python manage.py runserver           # dev server (SQLite)
python manage.py migrate             # apply migrations
python manage.py makemigrations      # create migrations
python manage.py check --deploy      # production readiness check
python manage.py test                # full suite
python manage.py test movie_csv.test_authentication   # single test module
python manage.py test movie_csv.test_authentication.ClerkAuthenticationTests.test_valid_token  # single test
python manage.py collectstatic --noinput
python manage.py createsuperuser
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT   # prod serve
```

### Frontend (run from `frontend/`)

```
npm install
npx expo start                       # dev (scan QR / press w for web)
npx expo start --web
npm run android / npm run ios        # native builds via expo run:*
npm run lint                         # expo lint (eslint-config-expo)
npx tsc --noEmit                     # typecheck
npm test                             # jest (jest-expo preset)
npx jest path/to/file.test.tsx       # single test file
npx jest -t "test name"              # single test by name
npx expo export --platform web       # static web build -> frontend/dist/
```

### Deploy

Render Blueprint at repo root (`render.yaml`) provisions the backend web service, the frontend static site, and Postgres. Push to the deploy branch; Render builds from `render.yaml`. See `SPEC.md` for the full env var list and `DEPLOY.md` (once written) for the runbook.

## Architecture

### Backend: two Django apps, one URL surface

- `movie_csv/` is the core app: `VideoEssay`, `Log`, `Like`, `Comment`, `Collection` models (`movie_csv/models.py`). `users/` holds `Profile` (1:1 with Django's `User`, plus `followers`/`following` M2M — see Boundaries below, these aren't wired to any endpoint yet).
- All routing lives under `/api/` — `movie_csv/urls/__init__.py` mounts `movie_csv/urls/api.py`, which registers every view in `movie_csv/views/api.py` (a single flat views file, not viewsets-per-file). `config/urls.py` only adds `/admin/`. There is no other web UI — the legacy Django-template UI (`views/web.py`, `templates/`, `users/urls.py`) was removed in favor of the Expo web app (see `SPEC.md` "Removed from the deployment").
- Auth is entirely Clerk, not Django sessions: `movie_csv/authentication.py`'s `ClerkAuthentication` verifies the `Authorization: Bearer <jwt>` against Clerk's JWKS (cached with a TTL — `CLERK_JWKS_CACHE_TTL`, default 600s) and lazily creates/updates the Django `User`/`Profile` on first sight of a `sub` claim. `CLERK_ISSUER` (+ optional `CLERK_ISSUER_LEGACY` for a dev→prod cutover window) is read from env in `config/settings.py`; DRF's `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated` by default, so views that should be public (e.g. `VideoEssays` list) override permissions explicitly per-view rather than at the settings level.
- `config/settings.py` is a single env-driven file (no `settings/` package split): `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`, CORS, and the Clerk issuer all read from env with dev-only fallbacks, and it raises at import time in production if a required var (e.g. `CLERK_ISSUER`) is missing. Render's `DATABASE_URL` selects Postgres via `dj-database-url`; unset, it falls back to local SQLite. WhiteNoise serves `/static/` (admin + DRF browsable API CSS only — there is no S3/media backend; `Profile.imageUrl` is always an external Clerk-hosted URL, never a local upload).
- YouTube search (`movie_csv/services/youtube_search.py`, wired through the `search/` endpoint in `views/api.py`) calls SerpAPI (`SERPAPI_KEY` env var); a missing key degrades to a 503 rather than crashing, and the frontend falls back to DB-only search results.

### Frontend: expo-router file-based routing, four route groups

- `frontend/app/` uses route groups: `(auth)` (Clerk sign-in/up), `(home)` (index feed, popular lists/reviews), `(tabs)` (search, profile, otherProfile, settings, about — the persistent tab bar), `(modals)` (log flow: `quickLog` → `logVideoModal`, plus `singleLog`, `listVideoEssay`, `collectionDetail`). The filename is the route path — expo-router does not care about the exported component's name, only the file's name/location — so route components should still be PascalCase-named for tooling (ESLint's `react-hooks` plugin only recognizes hook calls inside functions that look like components) even though it has no effect on navigation.
- `frontend/app/_layout.tsx` is the actual root: it wraps everything in `ClerkProvider` and branches navigation chrome by platform — `WebNav` for `Platform.OS === 'web'`, `MobileNav` otherwise — inside a single shared `<Stack>`. Most screens do not otherwise branch behavior by platform; there is no responsive/breakpoint layer, so web currently renders the same mobile-width UI as native.
- `frontend/src/api/client.ts` is the single source of the backend base URL: `EXPO_PUBLIC_API_BASE_URL` when set (required for web/prod), else platform-aware local-network discovery for dev (`10.0.2.2` for Android emulator, `127.0.0.1` for iOS sim/web). Other `src/api/*.ts` files (`logs.ts`, `collection.ts`, `videos.ts`, `users.ts`, etc.) build on this client and expect a Clerk token passed in — `src/api/authPost.ts`/`authUpdate.ts`/`authDelete.ts` are hooks that grab the token via `useAuth()` from `@clerk/clerk-expo` and call `client.ts`'s `authFetch`.
- `frontend/src/screens/` holds the actual screen implementations; `frontend/app/**` route files are thin wrappers that read `useLocalSearchParams`, fetch what the screen needs, and render the matching component from `src/screens/`.
- The log flow is two-step by design: `quickLog.tsx` is a bottom-sheet (`@gorhom/bottom-sheet`) rating-only quick log; swiping/expanding it opens `logVideoModal.tsx` for a full review. Both call `createLog` (`src/api/logs.ts`).

## Testing conventions

- Backend: Django's test runner, one file per concern under `movie_csv/` (`test_authentication.py`, `test_log_create.py`, `test_youtube_search.py`, `test_render_blueprint.py`, `test_deploy_smoke.py` — the last two guard `render.yaml` content and production settings behavior via subprocess checks, not just Django's `check`). New backend tests should follow this per-concern-file pattern rather than piling into `tests.py`.
- Frontend: no broad test suite yet — `jest-expo` is configured but currently only exercises a "Prove-It" regression test (`app/(modals)/__tests__/logVideoModal.test.tsx`, guarding a double-tap-creates-duplicate-log bug). Frontend gates for this project are `tsc --noEmit`, `expo lint`, and `expo export --platform web` succeeding, not coverage.

## Notable constraints

- Never hardcode a Clerk issuer, backend host, or secret in source — everything env-driven per `config/settings.py`'s pattern; `frontend/src/api/client.ts` must stay the only place the backend URL is resolved.
- Migrations are committed and never edited after being applied — add a new migration instead.
- `movie_csv/models.py` and `users/models.py` have several commented-out fields/models (`WatchList`, `display_username`, `Profile.photo`) — these are deliberately unfinished, not accidental; don't assume they're dead code to delete without checking `tasks/todo.md` for context first.
