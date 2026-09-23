# Todo: Follow-ups from the find-people work

Plan: `tasks/plan-find-people-followups.md`. Source list: bottom of `tasks/todo-find-people.md`
plus two items noted in its T7. Branch `v2`. Backend tests from `backend/` (`.venv/bin/python`),
frontend gates from `frontend/`: `npx jest`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web`.

## Approved now

### T1: Reject anonymous `POST /api/collections/` (G2)
- [ ] RED: anonymous POST → 401; authenticated POST unchanged; anonymous GET still 200
- [ ] `CollectionList.get_permissions()` — `AllowAny` for GET, `IsAuthenticated` for POST
- Acceptance: no 500 on anonymous create; list stays public
- Verify: `manage.py test movie_csv.test_collection_privacy movie_csv.test_collection_owner` then full suite
- Files: `movie_csv/views/api.py`, `movie_csv/test_collection_privacy.py` · Scope: XS

### T2: Drop redundant client-side watchlist filter in Popular Lists (G6)
- [ ] Remove `!name.includes("Watchlist")` filter + dead `console.log` in `popularLists.tsx`
- [ ] Test: a user list named with "Watchlist" in it now shows in Popular Lists
- Verify: `npx jest` · `tsc` · lint · `expo export --platform web`
- Files: `frontend/app/(home)/popularLists.tsx`, test · Scope: XS

### T3: Extract shared `usePagedSearch` hook (G5)
- [ ] Test the hook directly (debounce, pagination, stale-response guard)
- [ ] `PeopleResults.tsx` and `ListResults.tsx` both use it; no visible/behavioral change
- Acceptance: existing suites for both screens pass unmodified
- Verify: `npx jest` · `tsc` · lint
- Files: `frontend/src/hooks/usePagedSearch.ts` (new + test), `PeopleResults.tsx`, `ListResults.tsx` · Scope: S

### Checkpoint
- [ ] Full gates green (backend + frontend), no regressions vs find-people T8 baseline

## Deferred — needs a decision or belongs elsewhere, not built here

- [ ] **G1 — users without `display_username` invisible to People search.** This is the same open item already tracked at the bottom of `tasks/todo-display-username.md`; not duplicated here. Pick that file back up when ready (needs: enforce at sign-up, or finish the backfill run).
- [ ] **G3 — real public/private field on `Collection`.** No spec yet. Needs a design pass (field, who can toggle it, `public_collections()`/`CollectionSearch` behavior) before it's a task list.
- [ ] **G4 — `pg_trgm` index on `display_username` / `Collection.name`.** Prod migration + Postgres extension. Explicitly "ask first" in the original note — needs your go-ahead and isn't urgent at closed-beta scale.
- [ ] **Rest of `F0`** (owner-only enforcement on `logDetail` / `DeleteLog`) is out of scope here — it's `tasks/todo-username-followups.md`'s item, on its own branch, still needing your go-ahead. `CollectionDetail`'s half is already done (find-people T3).
