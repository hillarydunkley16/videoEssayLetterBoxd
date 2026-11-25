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
- [ ] Manual (yours): both endpoints as a real signed-in user; watchlist absent everywhere (automated equivalent: `test_search_routes.py`)
- [x] Review before Phase B (approved by continuing)

## Phase B — Frontend

### T5: API functions + extract `UserRow`  ✅ DONE
- [x] `searchUsers(q, page, token)` in `users.ts`; `searchCollections(q, page, token)` in `collection.ts` (paginated types)
- [x] Extract row (avatar, name, follow button, busy guard, open profile) from `FollowListScreen` into `UserRow.tsx`; `FollowListScreen` uses it
- Acceptance: no visible change; existing `FollowListScreen` tests pass unmodified
- Verify: `npx jest` · `tsc` · lint
- Files: `users.ts`, `collection.ts`, `UserRow.tsx`, `FollowListScreen.tsx`, types · Scope: S
- Done: 11 new tests (4 API URL/encoding, 7 `UserRow`). `FollowListScreen.test.tsx` unmodified, 18/18 pass. `UserRow` is presentational (busy state and toggle logic stay in the parent); T6 will need its own small toggle in `PeopleResults`. Gates: jest 16 suites / 84 tests (was 14 / 73), `tsc` 38 (= baseline), lint 3 errors (= baseline), 194 warnings (baseline 195). Web export deferred to T8.

### T6: Modes scaffold + People view + feed button  ✅ DONE
- [x] Jest first: `type` param picks view; unknown → essays; essays behavior unchanged; `mode=log` forces essays; mode switch keeps `q`; debounce; stale-response drop across keystroke and mode; empty input shows suggested; follow toggle + busy guard; empty/error states
- [x] `SearchScreen`: read `type`, mode switch (Essays | People | Lists), render `PeopleResults`; `SearchField` placeholder follows `type`; `FollowingFeedScreen` button → `/search?type=people`
- Acceptance: spec criteria 1–5, 6–7, 10 (People)
- Verify: `npx jest` · `tsc` · lint · manual `expo start --web`
- Files: `SearchScreen.tsx`, `PeopleResults.tsx`, `SearchField.tsx`, `FollowingFeedScreen.tsx`, test · Scope: M · Depends on: T1, T5
- Done: 41 new tests across `searchModes`, `PeopleResults`, `SearchScreen.modes`, `SearchField` (placeholder). `SearchScreen.logMode.test.tsx` and `FollowListScreen.test.tsx` unmodified and green. Two existing tests touched, both intended: `FollowingFeedScreen.test.tsx` (button now pushes `{ pathname: '/search', params: { type: 'people' } }`) and `SearchField.test.tsx` (mock records props; no assertion changed).
- Essays untouched: the old component is renamed `EssayResults` with its body unchanged; a new `SearchScreen` wrapper adds the switch and picks the view. The switch shows Essays | People only; **T7 adds the Lists chip**, and `type=lists` falls back to essays until then (`searchModes.ts`, tested).
- Decisions to review: a 1-character query shows Suggested (backend returns nothing under 2); the follow toggle in `PeopleResults` is a ~10-line copy of the one in `FollowListScreen` (not extracted); while typing, the list is replaced by a spinner per query, matching the essay screen.
- Gates: jest 19 suites / 125 tests (baseline 14 / 73); `tsc` 38 (= baseline); lint 3 errors (= baseline), warnings 198 vs 195 (new tests follow the repo's existing `jest.mock`-then-import style). Mutation check: removing the stale-answer guard fails its test.
- Not verified in a browser/device (web export and manual pass are T8).

### T7: Lists view  ✅ DONE
- [x] Jest first: lists mode queries `searchCollections`; empty input shows "Search lists by name"; tap → `collectionDetail`; empty/error states
- [x] `ListResults.tsx` reusing the existing list card
- Acceptance: spec criteria 8–10 (Lists)
- Files: `ListResults.tsx`, `SearchScreen.tsx`, test · Scope: S · Depends on: T4, T6
- Done: 20 new tests (`ListResults` 13, `ListCard` 3, plus Lists cases in `SearchScreen.modes`, `searchModes`, `SearchField`). Existing assertions changed on purpose (T6 had `lists` fall back to essays until this task): `searchModes.test.ts`, `SearchScreen.modes.test.tsx`. `ListCard` gained an opt-in `showOwner` prop ("by <owner>"); "Your Lists" is unchanged.
- Gates: jest 21 suites / 144 tests (baseline 14 / 73); `tsc` 38 (= baseline); lint 3 errors (= baseline), warnings 201 vs 195 (new tests follow the repo's `jest.mock`-then-import style). Mutation check: removing the stale-answer guard fails its test.
- Follow-ups noticed: `ListResults` and `PeopleResults` share ~50 lines of debounce/pagination/stale-guard logic (a `usePagedSearch` hook would remove it; both suites would guard the refactor). `app/(home)/popularLists.tsx` still filters watchlists client-side by name (`!name.includes("Watchlist")`); redundant now, and hides any list merely named with that word.

### T8: Mobile + full gates  ✅ DONE (automated); manual items below are yours
- [x] Mobile: `MobileTopNav` uses the shared `SearchField` and reaches the same search screen, so the switch and placeholder apply on mobile with no extra code. Log tab (`mode=log`) hides the switch and stays on essays even with a stale `type=people|lists` (tested in `SearchScreen.modes` and `SearchField`).
- [x] Added `backend/movie_csv/test_search_routes.py` (5 tests): both routes are registered and reject no/bad Clerk tokens through the real auth stack; a watchlist is absent from `/api/collections/` (signed in and anonymous) and from list search. Mutation-checked: deleting the list-search route fails 3 of them.
- [x] All gates, fresh: backend 278 tests OK, `makemigrations --check` clean, `manage.py check` clean; jest 21 suites / 144 tests; `tsc` 38 (= baseline); lint 3 errors (= baseline), 201 warnings (baseline 195; new tests use the repo's mock-then-import style); `expo export --platform web` succeeds and the bundle contains the new screens and both endpoint paths.
- Files: `backend/movie_csv/test_search_routes.py`, this file · Scope: S

**Manual checks still to do (need a browser/device and a real Clerk session; not run):**
- [ ] `expo start --web`: empty feed -> "Find people to follow" -> People mode with suggestions; type 2+ chars; follow; row flips
- [ ] Add an essay to your watchlist, then search Lists for its name: the watchlist must not appear (also try someone else's)
- [ ] Top-nav bar in each mode: placeholder changes, `q` survives a mode switch
- [ ] Mobile (simulator/device): switch visible under the top bar; Log tab still opens quick log
- [ ] Backend: `curl` both search endpoints with a real token after deploy

### Checkpoint B / Final
Spec success criteria, verified by automated evidence:
- [x] Acceptance criteria 1-10 covered by tests (backend 278, frontend 144)
- [x] Watchlist provably absent from Lists search, both owners + legacy-named row (`test_list_search`, `test_collection_privacy`, `test_search_routes`)
- [x] Essays search unchanged (existing `SearchScreen.logMode` tests pass unmodified)
- [x] Both endpoints run a constant number of queries; no new `tsc`/lint errors vs T0 (`tsc` 38 = 38, lint errors 3 = 3); web export builds
Still open:
- [ ] Manual walkthrough in a browser/device with a real Clerk session (list under T8)
- [ ] Human review, then PR using the org PR template (backend deploys before frontend)

---

## Follow-up issues (out of scope, tracked)
- [ ] **Users without a `display_username` are invisible to People search.** Every user should have a username: make sign-up require one / ensure the Clerk claim + `backfill_display_usernames` cover everyone, then drop the caveat. (See `tasks/todo-display-username.md`.)
- [ ] `pg_trgm` index for `icontains` on `display_username` / `Collection.name` if tables grow (migration — ask first)
- [ ] Real public/private field on `Collection` (ordinary lists are all public today)
- [ ] `CollectionList` POST uses `request.user` under `AllowAny` (anonymous POST would error); tighten separately
