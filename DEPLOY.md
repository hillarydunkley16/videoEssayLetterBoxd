# Deploy Runbook — Closed Beta

This is the step-by-step guide to standing up (or rebuilding from scratch) the
closed-beta deployment described in `SPEC.md`. It assumes you already have a
Render account and a GitHub repo connected to it.

**Live URLs (current beta):**
- Backend: https://videoessay-backend.onrender.com
- Frontend: https://videoessay-web.onrender.com

## ⚠️ Known near-term action item

The free Postgres instance (`videoessay-db`) **expires 90 days after
creation**. It was created 2026-09-07, so it expires **2026-10-07**. Render
does not auto-renew a free Postgres instance — before that date, either:
- Upgrade `videoessay-db` to a paid plan in the Render dashboard (Postgres →
  the instance → "Upgrade"), or
- Take a manual `pg_dump` backup and be ready to re-provision + restore.

Missing this date means losing all beta data. Check `render.yaml`'s
`databases:` block and the dashboard's expiration banner to confirm the
current status before that date.

## 1. Prerequisites

- A Render account, with this repo connected as a GitHub source.
- A Clerk account with the **development** instance already created (the beta
  intentionally uses Clerk dev, not prod — see "Clerk setup" below for why).
- A SerpAPI account (free tier is ~100 searches/month) for `SERPAPI_KEY`.

## 2. First-time provisioning (Blueprint deploy)

1. In the Render dashboard: **New → Blueprint**, point it at this repo, branch
   `v2` (or `main` after Task 16's merge). Render reads `render.yaml` at the
   repo root and provisions all three resources in one pass:
   - `videoessay-db` — Postgres, free plan
   - `videoessay-backend` — Python web service, free plan
   - `videoessay-web` — static site, free plan
2. The first deploy will likely fail or come up partially broken, because
   several env vars are intentionally `sync: false` in `render.yaml` (Render
   won't guess secrets or the frontend's own URL for you). That's expected —
   continue to step 3.
3. Set every `sync: false` env var per the table below, then trigger a manual
   redeploy of both services (**Manual Deploy → Deploy latest commit**, or
   just **Save Changes** on the Environment tab, which redeploys
   automatically).
4. Once `videoessay-backend` is live, add its own web origin's frontend
   counterpart: set `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, and
   `CORS_ALLOWED_ORIGINS` on the backend to `videoessay-web`'s real URL (see
   table), then redeploy the backend again.
5. Create a Django superuser via the backend's **Shell** tab in the Render
   dashboard:
   ```
   python manage.py createsuperuser
   ```
   Confirm `/admin/login/` on the deployed backend works with those
   credentials.

## 3. Every env var and where its value comes from

### `videoessay-backend`

| Key | Source | Notes |
|---|---|---|
| `PYTHON_VERSION` | literal `3.13.7` in `render.yaml` | Render ignores `runtime.txt` and defaults to a newer Python otherwise — pin explicitly. |
| `DATABASE_URL` | `fromDatabase: videoessay-db` in `render.yaml` | Wired automatically by the Blueprint; never set by hand. |
| `DJANGO_SECRET_KEY` | `generateValue: true` in `render.yaml` | Render generates and stores this; never set by hand, never commit it. |
| `DJANGO_DEBUG` | literal `"false"` in `render.yaml` | Must stay `false` in any real deployment. |
| `DJANGO_ALLOWED_HOSTS` | dashboard, `sync: false` | Set to `videoessay-backend.onrender.com` (its own host — also auto-trusted via `RENDER_EXTERNAL_HOSTNAME`, but set explicitly per Task 13). |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | dashboard, `sync: false` | Set to `https://videoessay-web.onrender.com` — the frontend's origin, with scheme. |
| `CORS_ALLOWED_ORIGINS` | dashboard, `sync: false` | Same value as above — comma-separate if you ever add a second frontend origin (e.g. a custom domain). |
| `CLERK_ISSUER` | literal in `render.yaml` (currently the dev instance URL) | This is a public URL, not a secret — set literally so an unset `sync: false` var can't silently break auth. Swap when cutting over to Clerk prod (see below). |
| `CLERK_ISSUER_LEGACY` | not set for the beta | Only needed during a dev→prod Clerk cutover window; leave unset until then. |
| `SERPAPI_KEY` | dashboard, `sync: false` | Real secret from serpapi.com. Missing it degrades `/api/search/` to a `503`, not a crash. |

### `videoessay-web`

| Key | Source | Notes |
|---|---|---|
| `NODE_VERSION` | literal `22.11.0` in `render.yaml` | Pinned for build reproducibility. |
| `EXPO_PUBLIC_API_BASE_URL` | dashboard, `sync: false` | Set to `https://videoessay-backend.onrender.com`. This is the *only* place the backend URL should ever be set — `frontend/src/api/client.ts` reads it and nothing else. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | dashboard, `sync: false` | Clerk **dev** instance's publishable key (`pk_test_...`). Public by design — it ships in the web bundle. |

Every var above should also appear (name only, no value) in
`backend/.env.example` and `frontend/.env.example` — cross-check those files
if this table and the Blueprint ever drift apart.

## 4. Clerk setup

The beta intentionally runs on Clerk's **development** instance
(`splendid-sunbird-55.clerk.accounts.dev`), not production. A Clerk
*production* instance requires a custom domain with DNS control, which the
`*.onrender.com` beta setup doesn't have.

**Before public launch**, when a custom domain exists:
1. Register the domain and point it at Render (see Render's custom-domain
   docs for the CNAME/A record).
2. Create a Clerk **production** instance, add its required DNS records.
3. Set the backend's `CLERK_ISSUER` to the new prod issuer, and move the old
   dev issuer into `CLERK_ISSUER_LEGACY` — `authentication.py` accepts tokens
   from both during the cutover window, so existing sessions don't break.
4. Set the frontend's `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the prod
   publishable key.
5. Once all traffic has cut over, remove `CLERK_ISSUER_LEGACY`.

## 5. Redeploying

Render auto-deploys on every push to the connected branch (`autoDeploy: yes`
in the service config). To redeploy without a new commit — e.g. after
changing an env var — use **Manual Deploy → Deploy latest commit** on the
service, or just save the Environment tab (which triggers a redeploy on its
own).

Before pushing a deploy-affecting change:
```
cd backend && python manage.py check --deploy && python manage.py test
cd frontend && npx tsc --noEmit && npm run lint && npx expo export --platform web
```

## 6. Rollback

- **Fastest path:** Render dashboard → the service → **Deploys** tab → find
  the last known-good deploy → **Rollback to this deploy**. This works for
  both `videoessay-backend` and `videoessay-web` independently.
- **Via git:** revert the offending commit(s) on the deploy branch and push —
  Render's `autoDeploy` picks it up automatically. Never force-push to rewrite
  history on `v2` or `main` to "undo" a bad deploy; a revert commit is safer
  and keeps the audit trail.
- **Database:** Render's automated Postgres backups (see the Postgres
  instance's **Backups** tab) are the recovery path for bad data, not code
  rollback. A schema-changing migration should be reverted with a new
  migration, never by editing or deleting an applied one (`SPEC.md`
  Boundaries).

## 7. Free-tier caveats

- **Cold start:** the backend web service spins down after ~15 minutes of
  inactivity; the next request pays a ~30-60s cold-start cost while it spins
  back up. Expected on the free plan — not a bug.
- **Postgres 90-day expiry:** see the warning at the top of this doc. This is
  the single most important thing to track on the free plan.
- **SerpAPI quota:** the free plan is ~100 searches/month. If beta usage
  exceeds that, `/api/search/` starts returning `502`/`504` (the app degrades
  to DB-only search results, but that's a real UX hit) — upgrade the SerpAPI
  plan or add caching before that becomes a problem.
- **Backups:** currently just Render's automated Postgres backups. No
  separate scheduled `pg_dump` — acceptable for closed beta, revisit before
  public launch.
- **Single instance:** the backend runs on a single free-tier instance, so
  there's no rolling-deploy/zero-downtime story and no migration race to
  worry about — `migrate` runs safely in `startCommand` before `gunicorn`
  starts.

## 8. Rotating a secret

If `SERPAPI_KEY` or `DJANGO_SECRET_KEY` is ever exposed (e.g. committed by
accident, leaked in a log), rotate it without a code change:

- **`SERPAPI_KEY`:** generate a new key at serpapi.com, paste it into
  `videoessay-backend`'s Environment tab, save. The old key can then be
  revoked on SerpAPI's side. `/api/search/` has no downtime from this — it
  just starts using the new key on the next request after redeploy.
- **`DJANGO_SECRET_KEY`:** delete the env var's current value in the
  dashboard and let Render's `generateValue: true` (from `render.yaml`)
  regenerate it on the next deploy, or paste in a manually generated one.
  Rotating this invalidates all existing sessions/signed cookies — expect
  every signed-in user to need to log back in.
- **Clerk keys:** rotated from the Clerk dashboard itself (API Keys page);
  update `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` on `videoessay-web` to match and
  redeploy the frontend. The backend's `CLERK_ISSUER` doesn't change during a
  same-instance key rotation.
- Never rotate a secret by editing `render.yaml` with a literal value — every
  real secret in this project stays `sync: false` (dashboard-only) or
  `generateValue: true`, never committed.

## 9. Manual acceptance checklist (run after any deploy-affecting change)

From `SPEC.md`'s Testing Strategy — all of these should pass against the live
URLs before telling beta testers to use the app:

1. Web URL loads; Clerk sign-up completes (the "development" badge on Clerk's
   UI is expected for the beta).
2. Search a video essay → log it → write a review → see it under that video.
3. Profile shows the new log; list/watchlist add works.
4. Reload / new browser session persists data (confirms Postgres, not
   ephemeral state).
5. An unauthenticated request to a protected endpoint (e.g.
   `GET /api/logList/`) returns `403`; the same request with a valid Clerk
   token returns `200`.
6. Backend response headers show `Strict-Transport-Security` and a specific
   (non-wildcard) `Access-Control-Allow-Origin` — never `*`.
