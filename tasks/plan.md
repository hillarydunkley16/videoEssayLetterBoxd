# Implementation Plan: Deploy to Closed Beta (Render + Expo web + Clerk dev instance)

Traces to `SPEC.md` at repo root.

## Overview

Take the current dev-only Django/DRF backend and Expo frontend to a live closed
beta: backend as a Render Web Service on Render PostgreSQL (free tier), frontend
as a Render Static Site serving the `expo export` web bundle, auth on the Clerk
**development** instance (a prod instance needs a custom domain — deferred to
before public launch). Work happens on `v2`; `v2` merges to `main` once the
deployment is verified green.

## Architecture Decisions

- **One `render.yaml` Blueprint** provisions all three resources (web service,
  static site, Postgres) so the environment is reproducible and reviewable in
  git. Rationale: solo operator, no infra team, must be able to rebuild from
  scratch.
- **`settings.py` stays a single file**, made env-driven with safe local
  defaults. No `settings/` package split. Rationale: closed beta has one
  environment; a split is premature.
- **WhiteNoise serves static** (Django admin + DRF browsable API only). No S3.
  Rationale: confirmed no code writes to `MEDIA_ROOT`; all user imagery is
  external Clerk URLs.
- **SQLite stays the local-dev default** via `dj_database_url` fallback; Postgres
  is prod-only through `DATABASE_URL`. Rationale: zero-friction local dev.
- **Free Render tier accepted for beta.** Known costs: ~50s cold start after
  inactivity, free Postgres expires ~90 days. Documented in `DEPLOY.md`.
- **Default `*.onrender.com` domains** for beta; no custom domain yet. Keeps
  `ALLOWED_HOSTS` / CORS / Clerk allowed-origins simple.
- **Dashboard actions stay with the operator.** Render provisioning and Clerk
  instance creation are done by the user in the web console; the agent supplies
  exact steps and the values to paste, and verifies the result.

## Task List

Tasks recorded in `tasks/todo.md`. Order is dependency-driven; do not reorder.

| # | Title | Type | Depends on |
|---|---|---|---|
| 1 | Commit current `v2` working tree | git | None |
| 1b | Create `backend/.venv` + rebuild `requirements.txt` on Django 5.2 LTS | backend | 1 |
| 2 | Repo hygiene: untrack secrets/artifacts, fix `.gitignore` | git/config | 1 |
| 3 | Commit migrations 0006–0008, verify no model drift | backend | 1b |
| 4 | Delete root-level pre-restructure cruft | cleanup | 2 |
| 5 | Env-driven `settings.py`: debug/secret/hosts/CORS/security | backend | 3 |
| 6 | Database via `dj-database-url` + WhiteNoise static pipeline | backend | 5 |
| 7 | Clerk config to env; JWKS cache TTL; logging not `print` | backend | 5 |
| 8 | Backend smoke tests + `.env.example` + `runtime.txt` | backend/test | 6, 7 |
| 9 | Add `render.yaml` Blueprint | infra | 6, 7 |
| 10 | Confirm Clerk **dev** instance, capture issuer + publishable key (prod instance deferred — needs a custom domain) | operator | None (can start anytime) |
| 11 | Provision backend + Postgres on Render, run migrations | operator | 8, 9, 10 |
| 12 | Frontend prod env wiring + `.env.example` + build gates | frontend | 11 |
| 13 | Deploy frontend static site on Render | operator | 12 |
| 14 | End-to-end acceptance against deployed URLs | verification | 11, 13 |
| 15 | Write `DEPLOY.md` runbook | docs | 14 |
| 16 | Merge `v2` → `main` | git | 14 |

### Checkpoint A: after Task 4
- [ ] `git ls-files` shows no `.env`, `db.sqlite3`, `*.pyc`, `.DS_Store`
- [ ] `cd backend && python manage.py check` still passes
- [ ] `cd backend && python manage.py runserver` boots; app unchanged locally
- [ ] Review with human before touching `settings.py`

### Checkpoint B: after Task 8
- [ ] With prod env vars set + `DJANGO_DEBUG` unset: `python manage.py check --deploy` → 0 issues
- [ ] With no env vars: local dev still works (SQLite, `runserver`, admin loads)
- [ ] `python manage.py test` passes
- [ ] `python manage.py makemigrations --check --dry-run` clean
- [ ] `collectstatic --noinput` succeeds
- [ ] Review with human before Render provisioning

### Checkpoint C: after Task 11
- [ ] Backend reachable at its `*.onrender.com` URL
- [ ] `GET /admin/` loads with CSS (WhiteNoise working)
- [ ] Authenticated API request with a Clerk token (dev instance) → 200; no token → 401
- [ ] Response headers: HTTPS redirect + HSTS present; `Access-Control-Allow-Origin` is specific, not `*`

### Checkpoint D: after Task 14 (Complete)
- [ ] All `SPEC.md` Success Criteria checked
- [ ] Full flow works on the deployed web URL, data persists across sessions
- [ ] Ready to invite testers; ready to merge to `main`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `settings.py` rewrite breaks local dev for the user | High | Safe defaults for every var; Checkpoint B explicitly re-tests the no-env-vars local path |
| ~~Clerk prod instance issuer/JWKS differs from dev~~ — RESOLVED: Clerk prod needs a custom domain the `*.onrender.com` beta lacks, so the beta stays on the **dev** instance (SPEC Open Q2). `CLERK_ISSUER` still env-driven; `CLERK_ISSUER_LEGACY` remains for the eventual prod cutover | Low | — |
| Free Render Postgres 90-day expiry / cold starts surprise testers | Med | Documented in `DEPLOY.md`; `pg_dump` note in Open Questions |
| Deleting root cruft breaks an unknown import/script | Med | Task 4 greps for references first; cruft is pre-restructure and not on any path when running from `backend/` |
| `expo export` web build hits the `error.md` `'(home)'` navigator bug | Med | Task 12 runs the export; Task 14 manually exercises routing on the built site; bug is dev-only per its own message |
| SerpAPI free quota (~100/mo) exhausted during beta | Low | Documented; search failures degrade gracefully (existing DB search still works) |
| `v2` working tree has ~2000 uncommitted lines mixing features + deploy prep | Med | Task 1 commits it as-is first so deploy changes are isolated in later commits |
| Old `requirements.txt` (Django 4.2.26 + prod deps) was never installed/verified; local dev ran a shared drifted venv on Django 5.2 | High | Task 1b builds a dedicated `backend/.venv`, rebuilds `requirements.txt` on Django 5.2 LTS, and verifies `check` + `pip check`; same file used on Render |
| `.env` files already committed in git history | Med | Task 2 untracks going forward; `DEPLOY.md` notes SERPAPI key + Clerk dev keys in history — rotate SERPAPI at Task 11, Clerk keys before public launch (beta still uses the dev instance) |

## Open Questions

- **Backups:** rely on Render's automated Postgres backups for beta, or also
  schedule a `pg_dump`? (Deferred — not blocking; note in `DEPLOY.md`.)
- **Secret rotation:** `.env` / `SERPAPI_KEY` / Clerk dev keys are in git history.
  The beta keeps using the Clerk dev instance, so its keys are still live — but a
  dev instance is low-value and rate-limited; rotating is optional for the beta,
  required before public launch. Rotate the SerpAPI key as part of Task 11.
- **Later (public launch, not now):** CI gate, Sentry, rate limiting on
  auth/search, native builds + store submission, staging environment.
