# Implementation Plan: Follow-ups from the display-username work

Follows `tasks/plan-display-username.md` (T0–T7 built). Task list: `tasks/todo-username-followups.md`.
Separate from `tasks/plan.md` (deploy) and the other plan files.

## Overview

Five problems surfaced while building the display-username feature. One is a security gap and should go first; the rest are small correctness fixes plus one migration-backed cleanup.

## Findings (verified in code)

| # | Problem | Evidence |
|---|---|---|
| P0 | **Anyone signed in can edit or delete anyone's logs and collections.** `IsOwnerOrReadOnly` (`movie_csv/permissions.py`) defines `has_objects_permission` (typo; DRF calls `has_object_permission`) so it would never run, and it is imported but not applied anywhere. `CollectionDetail` (`RetrieveUpdateDestroy`, queryset `all()`), `logDetail` (same) and `DeleteLog` (`DestroyAPIView`, queryset `all()`) are guarded only by `IsAuthenticated`. The `is_owner`/`is_mine` fields from T4/T5 are UI-only and don't enforce anything. | `permissions.py`; `views/api.py` (`CollectionDetail`, `logDetail`, `DeleteLog`); urls `collections/<uuid>/`, `logList/<uuid>/`, `logList/<uuid>/delete` |
| P1 | **"Liked by me" is always false on load.** `LikeSerializer` returns `user` as a bare pk, but `logInfo.tsx:64` reads `item.user.id` and compares to `Number(user?.id)` (Clerk string id → `NaN`). The frontend `Like` type is also wrong (`user: Profile`). | `serializers.py` `LikeSerializer`; `logInfo.tsx:62-65`; `types/like.ts` |
| P2 | **`GET /api/users/` returns every user's raw Clerk id** (`UserSerializer.username`, `IsAuthenticated` only). No screen uses it. Related dead/broken code: `UserDetail.get(self, request)` lacks the `pk` the URL passes and returns a non-Response (500s); `LoginView` is unrouted, has an `authentication__classes` typo and empty permissions; `users/serializers.py` lists `imageUrl`, which isn't a `User` field; `createUserScreen.tsx` isn't routed. | `views/api.py`; `urls/api.py:14-15`; `users/serializers.py`; grep for `createUserScreen` |
| P3 | **Watchlist identified by name.** `get_watchList` does `get_or_create(name="<clerk id>'s Watchlist", owner=...)`; `RemoveCollection` blocks deletes with `"Watchlist" in collection.name` (so it also blocks deleting any user list with "Watchlist" in its name); the backend never sets `is_watchlist`, so `collectionInfo.tsx:135` shows delete/edit controls on the owner's own watchlist; the page title shows the raw Clerk id ("user_2abc's Watchlist"); no unique constraint, so a race or a user-created list with that name can produce duplicates and `MultipleObjectsReturned` (500). | `serializers.py` `get_watchList`; `views/api.py` `RemoveCollection`; `collectionInfo.tsx:116,135` |

## Decisions (2026-09-21)

1. **F0 gets its own branch and PR.** It still needs explicit go-ahead before implementation (permissions change).
2. **Read-only prod query done (2026-09-21, `videoessay-db`).** 2 users, 2 profiles, 2 collections; both collections are exact `"<username>'s Watchlist"` rows, none flagged, no owner with duplicates, no other list has "Watchlist" in its name. `users_profile.display_username` doesn't exist yet in prod (the T1 migration isn't deployed). F3a's migration will flag 2 rows and the constraint will apply cleanly.
3. **Dead code is NOT deleted.** You want to review it first. F5 is replaced by a review list (below); no removals are planned.
4. **Watchlist title reads "<username>'s Watchlist"** using the display username. Because the title is now derived, F3a no longer renames rows (less lossy, simpler reverse). With no display username the title falls back to plain "Watchlist".

## Dependency graph

```
F0 owner permissions (independent, do first)
F1 is_liked            (independent)
F2 UserSerializer name (independent)
F3a watchlist data migration + unique constraint  ──> F3b switch code to is_watchlist
                       ^ prod duplicate check
```

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| F0 breaks a frontend flow that (wrongly) relied on cross-user writes. | Med | Grep frontend callers of the three endpoints first; tests for owner OK / other user 403 / read still open. |
| F3a: duplicate watchlists for one owner make the partial unique index fail. | High | Check prod first; migration flags only the lowest-id row per owner, leaves duplicates unflagged and reports them; no deletes. Constraint added only after data is clean. |
| Stored watchlist names keep the raw Clerk id (`user_2abc's Watchlist`) in the DB. | Low | Not shown anywhere: the serializer derives the title from the display username for `is_watchlist` rows. Reverse migration is just "unflag". |
| F3b deploys before/without F3a. | Med | Same release; F3b's `get_or_create` on `is_watchlist=True` would otherwise create a second watchlist. Order them in one deploy. |

## Task list

### Phase 0: Security
- [ ] F0: Enforce ownership on log and collection writes

### Checkpoint: Security
- [ ] Other users get 403 on PATCH/DELETE; owners unaffected; full suite green; human sign-off

### Phase 1: Small correctness fixes
- [ ] F1: `is_liked` on logs (fixes liked-by-me)
- [ ] F2: `UserSerializer` shows display username

### Phase 2: Watchlist
- [ ] F3a: Flag watchlists + one-watchlist-per-owner constraint
- [ ] F3b: Look up and protect watchlists by `is_watchlist`; title from the display username

### Checkpoint: Complete
- [ ] Watchlist page shows "<username>'s Watchlist" with no delete/edit controls; no raw Clerk ids in any API response for other users

### For your review (no changes planned)
- [ ] Dead-code list below, to decide what to delete

## Open questions

- None outstanding.

## Dead code for your review (nothing will be deleted without your say-so)

| Item | Why it looks dead | Evidence |
|---|---|---|
| `frontend/src/screens/createUserScreen.tsx` | Not imported by any route | grep for `createUserScreen` finds only its own file |
| `fetchUsers`, `fetchAUser` in `frontend/src/api/users.ts` | Only `createUserScreen` calls `fetchUsers`; `fetchAUser` has no callers I found | grep |
| `GET /api/users/` (`UserList`) | No live frontend caller; returns every user (F2 hides the Clerk ids but the endpoint stays) | `urls/api.py:14` |
| `UserDetail` (`/api/users/<pk>/`) | Returns a 500 today: `get(self, request)` lacks the `pk` the URL passes and returns a non-Response | `views/api.py` |
| `LoginView` | Not in any URL; has an `authentication__classes` typo and empty permissions; legacy token login | `urls/api.py` has no login route |
| `backend/users/serializers.py` | Nothing imports it; lists `imageUrl`, which is not a `User` field | grep |
| `frontend/src/api/auth.ts` `login()` | I found no callers (auth is Clerk) | grep |
