# Search Modes (Essays / People / Lists) — Task List

Plan: `tasks/plan-find-people.md`. Spec: `SPEC-find-people.md`. Branch: `v2`.
Backend commands from `backend/` using `.venv/bin/python` (system python has no Django).
Frontend commands from `frontend/`. Gates: `manage.py test`, `npx jest`, `npx tsc --noEmit`,
`npm run lint`, `npx expo export --platform web`.

---

## Baseline (T0, 2026-09-21, branch `v2`)

| Gate | Result |
|---|---|
| `manage.py test` | 234 tests, OK |
| `makemigrations --check` | No changes detected |
| `npx jest` | 14 suites, 73 tests passed |
| `npx tsc --noEmit` | 38 errors (pre-existing) |
| `npm run lint` | 198 problems: 3 errors, 195 warnings (pre-existing) |

"No new errors" in later tasks means: tsc stays at 38, lint errors stay at 3, tests only go up.

---

## Phase A — Backend

### T0: Baseline  ✅ DONE
- [x] Record current results of the four gates (counts / known errors) at the top of this file
- Acceptance: later "no new errors" claims have a baseline · Files: this file · Scope: XS

### T1: `people-search` — `GET /api/users/search/`  ✅ DONE
- [x] `test_user_search.py` first: substring/case; exact→prefix→followers→id order; viewer excluded; null `display_username` excluded; `is_following`; `q` <2 chars → empty; `%`/`_` literal; 401; stable pagination; `assertNumQueries` constant
- [x] `UserSearch` view (beside `SuggestedUsers`) + route `users/search/`
- Acceptance: spec criteria 6; Clerk id never in payload
- Verify: `manage.py test movie_csv.test_user_search` then full suite
- Files: `views/api.py`, `urls/api.py`, `test_user_search.py` · Scope: S

### T2: `collection-privacy` — close the read leaks  ✅ DONE
- [x] `test_collection_privacy.py` first: list has no watchlist for anonymous / other / own viewer; detail 404 on another user's watchlist, 200 on own, 200 on others' ordinary lists
- [x] `public_collections()` helper; `CollectionList` uses it; `CollectionDetail` 404s foreign watchlists
- [x] Update only the assertions in `test_collection_owner.py` / `test_watchlist.py` that assumed the leak
- Acceptance: spec 0a–0c; `popularLists` and own-watchlist detail still work
- Verify: `manage.py test movie_csv.test_collection_privacy movie_csv.test_collection_owner movie_csv.test_watchlist` then full suite
- Files: `views/api.py`, `test_collection_privacy.py`, ≤2 existing tests · Scope: S
- Done: 9 new tests; `public_collections()` added; `CollectionList` uses it; `CollectionDetail` 404s foreign watchlists. Only existing test changed: `test_watchlist.py::test_collection_detail_and_list_use_the_derived_title_and_flag` (it asserted a friend could read the watchlist; now the owner reads it via detail and the list omits it, renamed accordingly). Full suite 256 OK.

### T3: Owner-only writes on `CollectionDetail`  ✅ DONE
- [x] Test first: non-owner PUT/PATCH/DELETE → 403/404; owner unchanged; reads unchanged
- [x] Use existing `IsOwnerOrReadOnly` on `CollectionDetail`. **Found in T2:** its method is misspelled `has_objects_permission` (DRF calls `has_object_permission`), so as written it enforces nothing. Fix the spelling too; it is imported in `views/api.py` but applied to no view, so nothing else changes. Add a test that fails before the rename.
- [ ] Note (own data, not privacy, leave unless asked): `CollectionDetail` DELETE can delete the owner's own watchlist, which `RemoveCollection` forbids
- Acceptance: a signed-in user cannot modify another user's list by UUID
- Verify: new tests + full suite
- Files: `views/api.py`, `permissions.py`, `test_collection_privacy.py` · Scope: XS · Depends on: T2
- Done: 5 new tests (`CollectionDetailWriteTests`); confirmed the tests still fail with the class wired in but the typo unfixed, pass after the rename. Full suite 261 OK. Non-owner write → 403; owner and reads unchanged.

### T4: `list-search` — `GET /api/collections/search/`  ✅ DONE
- [x] `test_list_search.py` first: name substring/case; **watchlist never returned** (other's, own, legacy-named flagged row); ordinary lists returned; exact→prefix→essay count→id; owner is display name; 401 (not anonymous); constant queries; `q` <2 → empty
- [x] `CollectionSearch` (IsAuthenticated) built on `public_collections()` + route
- Acceptance: spec criteria 8–9
- Verify: `manage.py test movie_csv.test_list_search` then full suite
- Files: `views/api.py`, `urls/api.py`, `test_list_search.py` · Scope: S · Depends on: T2
- Done: 12 new tests. Mutation-checked: making `public_collections()` return everything fails `test_a_watchlist_is_never_returned`. Full suite 273 OK; both search routes resolve to their own views.

### Checkpoint A
- [x] Full backend suite green (273); `makemigrations --check` clean
- [ ] Manual: both endpoints as a signed-in user; watchlist absent everywhere
- [ ] Review before Phase B

## Phase B — Frontend

### T5: API functions + extract `UserRow`
- [ ] `searchUsers(q, page, token)` in `users.ts`; `searchCollections(q, page, token)` in `collection.ts` (paginated types)
- [ ] Extract row (avatar, name, follow button, busy guard, open profile) from `FollowListScreen` into `UserRow.tsx`; `FollowListScreen` uses it
- Acceptance: no visible change; existing `FollowListScreen` tests pass unmodified
- Verify: `npx jest` · `tsc` · lint
- Files: `users.ts`, `collection.ts`, `UserRow.tsx`, `FollowListScreen.tsx`, types · Scope: S

### T6: Modes scaffold + People view + feed button
- [ ] Jest first: `type` param picks view; unknown → essays; essays behavior unchanged; `mode=log` forces essays; mode switch keeps `q`; debounce; stale-response drop across keystroke and mode; empty input shows suggested; follow toggle + busy guard; empty/error states
- [ ] `SearchScreen`: read `type`, mode switch (Essays | People | Lists), render `PeopleResults`; `SearchField` placeholder follows `type`; `FollowingFeedScreen` button → `/search?type=people`
- Acceptance: spec criteria 1–5, 6–7, 10 (People)
- Verify: `npx jest` · `tsc` · lint · manual `expo start --web`
- Files: `SearchScreen.tsx`, `PeopleResults.tsx`, `SearchField.tsx`, `FollowingFeedScreen.tsx`, test · Scope: M · Depends on: T1, T5

### T7: Lists view
- [ ] Jest first: lists mode queries `searchCollections`; empty input shows "Search lists by name"; tap → `collectionDetail`; empty/error states
- [ ] `ListResults.tsx` reusing the existing list card
- Acceptance: spec criteria 8–10 (Lists)
- Files: `ListResults.tsx`, `SearchScreen.tsx`, test · Scope: S · Depends on: T4, T6

### T8: Mobile + full gates
- [ ] Mode switch works on mobile top nav; Log tab (`mode=log`) still opens quick log
- [ ] All gates; manual: watchlist item added → watchlist never appears in Lists search
- Acceptance: spec success criteria all met
- Files: as needed (≤3) · Scope: S · Depends on: T6, T7

### Checkpoint B / Final
- [ ] All `SPEC-find-people.md` success criteria met · no new `tsc`/lint errors vs T0
- [ ] Ready for review / PR (org PR template)

---

## Follow-up issues (out of scope, tracked)
- [ ] **Users without a `display_username` are invisible to People search.** Every user should have a username: make sign-up require one / ensure the Clerk claim + `backfill_display_usernames` cover everyone, then drop the caveat. (See `tasks/todo-display-username.md`.)
- [ ] `pg_trgm` index for `icontains` on `display_username` / `Collection.name` if tables grow (migration — ask first)
- [ ] Real public/private field on `Collection` (ordinary lists are all public today)
- [ ] `CollectionList` POST uses `request.user` under `AllowAny` (anonymous POST would error); tighten separately
