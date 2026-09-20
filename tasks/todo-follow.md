# Follower Functionality: Task List

Plan: `tasks/plan-follow.md`. Specs: `SPEC-follow*.md`. Deploy tasks live separately in `tasks/todo.md`. Branch: `v2`.
Python: use `backend/.venv/bin/python`. Do tasks in order; write the failing test first; each task ends with its Verify step.

## Phase 0: Specs and baseline
- [x] Task 0: Specs written and approved
- [x] Task 1: Baseline (5/5 follow tests, full suite 78/78, `makemigrations --check` clean)

**Checkpoint 0: done**

## Phase 1: follow-core
- [x] Task 2: `Follow` model + schema migration + data migration from old M2Ms (model in `users/models.py`; migrations 0009, 0010; 10 new tests, suite 88/88)
  - Acceptance: rows copied exactly once; DB rejects duplicate and self follows; migrations 0007/0008 untouched
  - Verify: `python manage.py test movie_csv.test_follow_model`; `makemigrations --check`; full suite
  - Files: models, 2 migrations, `test_follow_model.py`
- [x] Task 3: Toggle endpoint backed by `Follow` (also mirrors to the legacy M2Ms until Task 5 removes them; 11 tests, suite 94/94)
  - Acceptance: response shape unchanged; tests assert on `Follow`; unauthenticated rejected; repeated toggles consistent
  - Verify: `python manage.py test movie_csv.test_follow`
  - Files: `views/api.py`, `test_follow.py`
- [x] Task 4: Profile `followers_count` / `following_count` / `is_following`, end to end (backend 102/102; jest 8/8; tsc error set unchanged at 37; web export OK)
  - Acceptance: no embedded user lists; constant query count; follower `print`s removed; button state from `is_following`; toggle updates count; double-tap guarded
  - Verify: `python manage.py test`; `npm test`; `npx tsc --noEmit` (no new errors); manual on `expo start --web`
  - Files: `serializers.py`, `views/api.py`, `types/profile.ts`, `otherProfile/[id].tsx`, `ProfileScreen.tsx`, tests
- [x] Task 5: Drop `Profile.followers` / `Profile.following` (migration C) (0011 reverses by refilling both M2M sides from Follow; suite 101/101; verified on a copy of the dev DB only, prod not touched)
  - Acceptance: no code references the fields; migration applies on a DB with data
  - Verify: full backend suite; grep for stale references; **ask before running against production**
  - Files: `users/models.py`, 1 migration

**Checkpoint 1: human review before Phases 2 and 3** (backend suite, jest, no new tsc/lint errors, manual follow/unfollow on web)

## Phase 2: follow-lists
- [x] Task 6: Followers list, end to end (backend 109/109; jest 16/16; tsc 39 vs 37 baseline, the 2 new are `/followList` missing from the gitignored generated typed-routes file, cleared when `expo start` regenerates it; web export OK; manual web check not done, needs Clerk sign-in)
  - Acceptance: paginated, ordered, viewer-relative `is_following`, 404 unknown user, constant queries; screen paginates, row toggle updates that row, empty state; follower count tappable on both profiles
  - Verify: `python manage.py test movie_csv.test_follow_lists`; jest for `FollowListScreen`; manual on web
  - Files: `views/api.py`, `serializers.py`, `urls/api.py`, `users.ts`, `(modals)/followList.tsx`, `FollowListScreen.tsx`, 2 profile screens, tests
- [x] Task 7: Following list, end to end (backend 117/117; jest 21/21; tsc 41 vs 37 baseline, all 4 new are `/followList` missing from the gitignored generated typed-routes file; web export OK; manual web check not done, needs Clerk sign-in)
  - Acceptance: same guarantees for `/following/`; Following tab in the same screen; following count tappable
  - Verify: extend `test_follow_lists.py` and the screen test; manual on web
- [x] Task 8: Remove follower (backend 126/126; jest 27/27; tsc 41, same as after Task 7; lint unchanged at 171; web export OK; own profile now reloads on focus so its counts refresh; manual web check not done, needs Clerk sign-in)
  - Acceptance: only the followee may remove (403 otherwise), 404 if no follow, 204 on success; re-follow allowed; counts and list update; "Remove" only on own followers list
  - Verify: backend permission-matrix tests; jest for the button

**Checkpoint 2:** lists reachable from both profiles, removal works, suites green

## Phase 3: follow-feed (independent of Phase 2)
- [ ] Task 9: `GET /api/feed/`
  - Acceptance: only followed users' logs; own excluded; `-date, -id`; paginated; empty 200 when following nobody; auth required; constant queries; unfollow removes their logs
  - Verify: `python manage.py test movie_csv.test_follow_feed`
  - Files: `views/api.py`, `urls/api.py`, test
- [ ] Task 10: Following feed section on home
  - Acceptance: shows logs; infinite scroll; pull to refresh; empty state links to search
  - Verify: `npm test`; `npx tsc --noEmit` (no new errors); manual on web
  - Files: `logs.ts`, `(home)/index.tsx`, test

**Checkpoint 3 (final):** all suites green; `npx expo export --platform web` succeeds; manual end to end (follow -> feed -> unfollow; lists; remove follower)
