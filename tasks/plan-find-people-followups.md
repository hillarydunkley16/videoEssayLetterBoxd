# Implementation Plan: Follow-ups from the find-people work

Follows `tasks/plan-find-people.md` / `tasks/todo-find-people.md` (T0–T8 built, branch `v2`).
Task list: `tasks/todo-find-people-followups.md`. Six items: four listed at the bottom of
`tasks/todo-find-people.md`, two more noticed while building T7/T8.

## Overview

Nothing here is required for the find-people feature to work as shipped; each item was deliberately
deferred. They fall into three groups: one visibility gap (users need a username to be found), one
already-known security gap that overlaps with the still-open `F0` in
`tasks/todo-username-followups.md`, and four small cleanups (index, schema, dedupe, dead filter).

## Findings (verified in code, 2026-09-22)

| # | Problem | Evidence |
|---|---|---|
| G1 | **Users without a `display_username` are invisible to People search.** `UserSearch` (and `SuggestedUsers`) filter/order on `display_username`; a null one is excluded by design (`SPEC-find-people.md` decision 4), but nothing yet *requires* every user to have one. | `movie_csv/views/api.py` `UserSearch`; `tasks/todo-display-username.md` still has T0 (Clerk claim manual step) and the backfill checkpoint unchecked |
| G2 | **`CollectionList.perform_create` runs under `AllowAny` but calls `serializer.save(owner=self.request.user)`.** An unauthenticated POST hits this with `request.user` as `AnonymousUser`, which has no valid FK id — this 500s rather than 401s. Read is intentionally public (T2 of find-people); only create needs a check. | `movie_csv/views/api.py:494-504` (`CollectionList`) |
| G3 | **No public/private field on `Collection`.** Every ordinary list is public today (by omission, not a documented decision) — `public_collections()` (built in find-people T2) has no visibility to enforce because there's nothing to check. Low priority unless/until list privacy is actually requested. | `movie_csv/models.py` `Collection`; `movie_csv/views/api.py` `public_collections()` |
| G4 | **No `pg_trgm` index on `display_username` / `Collection.name`.** Fine at current scale (closed beta); an `icontains` scan gets slow once these tables grow. Needs a migration — explicitly flagged "ask first" in the original list since it changes prod schema/extensions. | `tasks/todo-find-people.md` follow-ups; `test_user_search.py` / `test_list_search.py` `assertNumQueries` tests would need to stay green |
| G5 | **`PeopleResults.tsx` and `ListResults.tsx` duplicate ~50 lines of debounce/pagination/stale-response-guard logic.** Noted in T7. A shared `usePagedSearch` hook would remove the duplication; existing suites for both screens already guard the behavior it would extract. | `frontend/src/screens/PeopleResults.tsx`, `frontend/src/screens/ListResults.tsx` (180 + 149 lines) |
| G6 | **`app/(home)/popularLists.tsx` still filters watchlists client-side by name** (`!name.includes("Watchlist")`), left over from before `public_collections()` existed server-side. Redundant now (the endpoint it calls already excludes watchlists via T2), and it incorrectly hides any ordinary list a user names with the word "Watchlist" in it. | `frontend/app/(home)/popularLists.tsx:18-20` |

## Relationship to other in-flight work

- **G2 overlaps `F0`** in `tasks/todo-username-followups.md` ("Enforce ownership on log and collection writes"), which is still unchecked and explicitly scoped to its own branch with an ownership-permissions go-ahead. `CollectionDetail` already got `IsOwnerOrReadOnly` (done as part of find-people T3); `logDetail` and `DeleteLog` still have only `IsAuthenticated`, i.e. F0 is only half-landed. **G2 here is narrower and lower-risk than F0**: it's about `CollectionList` rejecting anonymous *create*, not about cross-user edit/delete on existing rows. Do G2 on its own; leave the rest of F0 (log/collection owner-write enforcement) to that other task list so the two efforts don't collide on the same file in parallel branches.
- **G1 overlaps the open follow-up in `tasks/todo-display-username.md`** ("Every user must have a display_username... Enforce at sign-up / finish backfill, then remove the caveat"). G1 doesn't re-litigate that; it just confirms the caveat is still live and cross-links so it isn't lost.

## Decisions needed from you before starting

1. **G2** (anonymous POST 500s instead of 401s): straightforward bug fix, no design choice — proceed without asking.
2. **G3** (public/private field): no current feature needs it. Recommend **not building it speculatively** — leave as a documented, deferred decision unless a real requirement shows up. (Confirm below.)
3. **G4** (`pg_trgm` index): needs your go-ahead per the original note — it's a prod migration adding a Postgres extension, not just a Django model change.
4. **G1** (username backfill / sign-up requirement): this is really the open item in `todo-display-username.md`, not new scope here — confirm whether to pick that file back up or leave it deferred.

## Task list (only what's approved to build now)

### T1: G2 — reject anonymous collection creation
- [ ] Test first: anonymous `POST /api/collections/` → 401 (not 500); authenticated create unchanged; anonymous `GET` still 200 (unchanged)
- [ ] Split `CollectionList` permissions by method (`get_permissions` returning `[AllowAny]` for `GET`, `[IsAuthenticated]` for `POST`) rather than instance-wide `AllowAny`
- Acceptance: no anonymous request can reach `perform_create`; list stays public
- Verify: `python manage.py test movie_csv.test_collection_privacy movie_csv.test_collection_owner` + full suite
- Files: `movie_csv/views/api.py`, `movie_csv/test_collection_privacy.py` · Scope: XS

### T2: G6 — drop the redundant client-side watchlist filter
- [ ] Confirm `popularLists.tsx`'s data source is `public_collections()`-backed (it is — same `/api/collections/` list endpoint) so the filter has nothing left to do
- [ ] Remove the `!name.includes("Watchlist")` filter and the commented-out `console.log` line next to it
- [ ] Add/keep a test asserting a user-named list containing "Watchlist" now renders in Popular Lists
- Verify: `npx jest` · `tsc` · lint · `expo export --platform web`
- Files: `frontend/app/(home)/popularLists.tsx`, its test · Scope: XS

### T3: G5 — extract `usePagedSearch`
- [ ] Test the hook directly first (debounce, pagination, stale-response guard) using the existing `PeopleResults`/`ListResults` test scenarios as the spec
- [ ] Extract from both screens; screens keep their own rendering/row components
- Acceptance: existing `PeopleResults`/`ListResults` suites pass unmodified (behavior-preserving refactor)
- Verify: `npx jest` · `tsc` · lint
- Files: new `frontend/src/hooks/usePagedSearch.ts` (+ test), `PeopleResults.tsx`, `ListResults.tsx` · Scope: S

### Checkpoint
- [ ] Full backend + frontend gates green, no regressions vs find-people's T8 baseline
- [ ] G1, G3, G4 stay recorded as deferred/blocked-on-decision below, not silently dropped

## Deferred (not building without your go-ahead)

- **G1**: tracked in `tasks/todo-display-username.md`'s own follow-up list; pick up there, not duplicated here.
- **G3**: no design/spec yet for list privacy; would need its own spec pass (`is_public` field, who can toggle it, what `public_collections()`/`CollectionSearch` do with it) before a task list makes sense.
- **G4**: prod migration + `pg_trgm` extension; needs your explicit approval per the original note, plus a scale trigger (current query counts are constant-but-not-indexed, fine at closed-beta size).
