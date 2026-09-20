# Implementation Plan: Follower Functionality

Separate from the deploy plan (`tasks/plan.md`, still in flight). Task list: `tasks/todo-follow.md`.
Specs (approved): `SPEC-follow.md` (map + decisions), `SPEC-follow-core.md`, `SPEC-follow-lists.md`, `SPEC-follow-feed.md`.

## Overview

The follow toggle already works end to end (`POST /api/users/<id>/follow/`, button on `otherProfile/[id].tsx`).
Remaining: one consistent data model, an efficient profile payload, follower/following lists with remove-follower,
and a following-only home feed.

## Baseline (Task 1, done)

`backend/.venv/bin/python manage.py test`: 78/78 pass, incl. the 5 follow tests; `makemigrations --check` clean.
System Python has no Django; always use `backend/.venv/bin/python`.

## Capability map and build order

```
follow-core  ->  follow-lists
             ->  follow-feed        (lists and feed independent of each other)
```

## Decisions (from approved specs)

Remove-follower only (no blocking); own logs excluded from feed; feed is an added home section;
feed orders `-date, -id` (no `Log.created_at`); separate spec per module.

## Slicing approach

Each task after the foundation is one vertical path (data -> API -> UI -> test) that leaves the app working.
Exceptions, both deliberate: Task 2 is a pure data foundation, and the feed is split API/UI because the API is
independently testable and the UI is the larger half.

## Dependency graph

```
T2 Follow model + data copy
 └─ T3 Toggle on Follow
     └─ T4 Profile counts + is_following (API + both profile screens)
         └─ T5 Drop old M2Ms (cleanup, after T4 verified)
         ├─ T6 Followers list  (endpoint + screen + tappable count)
         │   └─ T7 Following list (endpoint + tab)
         │       └─ T8 Remove follower
         └─ T9 Feed API
             └─ T10 Feed UI
```

T6-T8 and T9-T10 are independent chains and may run in either order.

## Phase 1: follow-core

### T2: `Follow` model + data migration (S)
- `Follow(follower, followee, created_at)`; unique `(follower, followee)`; check `follower != followee`; index on `followee`.
- Migration A (schema) and B (`RunPython` copy from `Profile.following`; log any row present only in `Profile.followers`; reverse no-op). Old M2Ms untouched, migrations 0007/0008 never edited.
- Acceptance: seeded rows copied exactly once; duplicates and self-follows rejected by the DB.
- Verify: `test_follow_model.py` (written first); `makemigrations --check`; full suite.
- **Ask-first item (schema change): approved with the plan.**

### T3: Toggle backed by `Follow` (S)
- `FollowUser` uses `Follow`; response shape unchanged.
- Acceptance: existing 5 tests updated to assert on `Follow`; add unauthenticated-rejected and repeated-toggle cases.
- Verify: `python manage.py test movie_csv.test_follow`.

### T4: Profile counts + `is_following`, end to end (M)
- Serializer: replace `followers`/`following` lists with `followers_count`, `following_count`, `is_following` (false on own profile), constant query count. Remove follower-related `print`s in `ProfileDetail`/`ProfileDetailById`.
- Frontend: `Profile` type; `otherProfile/[id].tsx` uses `is_following`/`followers_count` (drop the username-vs-Clerk-id match); `ProfileScreen.tsx` uses the counts.
- Acceptance: no embedded user lists in the response; button initial state correct; toggle updates count; double-tap guarded.
- Verify: `assertNumQueries` tests; new jest test for the follow button (initial state, toggle, busy guard, error path); `npx tsc --noEmit` no new errors; manual on `expo start --web`.
- Ships in one deploy (backend and frontend together).

### T5: Drop the old M2Ms (S)
- Migration C removes `Profile.followers` / `Profile.following`; delete remaining references.
- Acceptance: no code references the fields; migration applies on a DB with data.
- Verify: full backend suite; grep for `\.followers\b|\.following\b` on Profile.
- Ask before applying to the production DB (verify copy counts first).

**Checkpoint 1 (follow-core done):** full backend suite, jest, no new `tsc`/lint errors, manual follow/unfollow on web. Human review before Phase 2/3.

## Phase 2: follow-lists

### T6: Followers list, end to end (M)
- `GET /api/users/<id>/followers/`: paginated, `-Follow.created_at, -id`, rows `{id, username, imageUrl, is_following}` (viewer-relative), 404 unknown user, auth required, constant queries.
- Frontend: `fetchFollowers`; `(modals)/followList.tsx` wrapper + `FollowListScreen.tsx` (infinite scroll, empty state, row -> profile, inline toggle); follower count tappable on both profile screens.
- Verify: `test_follow_lists.py`; jest for the screen; manual on web.

### T7: Following list, end to end (S)
- `GET /api/users/<id>/following/` + Following tab in the same screen; following count tappable.
- Verify: extend `test_follow_lists.py` and the screen test.

### T8: Remove follower (S)
- `DELETE /api/users/<id>/followers/<follower_id>/`: only the followee (403 otherwise), 404 if no such follow, 204 on success; re-follow still allowed. "Remove" shown only on your own followers list.
- Verify: permission-matrix backend tests; jest for the button and list update.

**Checkpoint 2:** lists reachable from both profiles, removal works, suites green.

## Phase 3: follow-feed

### T9: Following feed API (S)
- `GET /api/feed/`: logs by followees, own excluded, `-date, -id`, paginated, `select_related("essay","owner")`, existing `LogSerializer`; empty 200 when following nobody; auth required; constant queries.
- Verify: `test_follow_feed.py` (incl. unfollow removes their logs).

### T10: Following feed on home (M)
- `fetchFollowingFeed` in `src/api/logs.ts`; "Following" section on `(home)/index.tsx` reusing existing log cards; infinite scroll, pull to refresh, empty state linking to search.
- Verify: jest; `tsc`/lint no new errors; manual on web.

**Checkpoint 3 (final):** all suites green, `npx expo export --platform web` succeeds, manual end to end: follow B -> B's log in feed -> unfollow -> gone; lists and remove-follower work.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Data migration loses or duplicates follows | High | `RunPython` copy + unique constraint, seeded-row test, M2Ms kept until T5 |
| Old M2Ms drifted (one side missing) | Med | Copy from `following`; log one-sided `followers` rows instead of dropping silently |
| Profile payload change breaks a deployed client | Med | T4 backend and frontend ship together; closed beta, single client |
| Dropping M2Ms in prod before verifying copy | High | T5 asks first and compares counts |
| Feed ordering is day-granular | Low | `-id` tie-break; `Log.created_at` is out of scope (ask first) |
| Pre-existing `tsc` (20) / lint (32) errors and open deploy tasks on `v2` | Med | Gate on "no new errors"; keep follow commits isolated from deploy work |

## Open questions

None outstanding.
