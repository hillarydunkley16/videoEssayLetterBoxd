# Todo: Follow-ups from the display-username work

Plan: `tasks/plan-username-followups.md`. Backend tests: `cd backend && .venv/bin/python manage.py test`. Frontend gates from `frontend/`.
Every task is tests-first (RED, then GREEN) and one commit each.

## Phase 0: Security

### F0: Enforce ownership on log and collection writes  (own branch + PR; needs explicit go-ahead: permissions change)
- [ ] Create a separate branch for F0
- [ ] Grep frontend callers of `PATCH/PUT/DELETE` on `collections/<id>/`, `logList/<id>/`, `logList/<id>/delete`; confirm they are owner-only flows
- [ ] RED: tests for each endpoint — owner may PATCH/DELETE; another user gets 403 and the row is unchanged; GET by another user still 200
- [ ] Fix `IsOwnerOrReadOnly.has_object_permission` (typo) and apply it to `CollectionDetail`, `logDetail`, `DeleteLog`
- Acceptance: non-owners cannot modify or delete; owners and reads unchanged
- Verify: `python manage.py test movie_csv` · manual: delete own log, edit own list
- Files: `movie_csv/permissions.py`, `movie_csv/views/api.py`, `movie_csv/test_owner_permissions.py` (new) · Scope: S

### Checkpoint: Security
- [ ] Full suite green; human review before merging

## Phase 1: Small correctness fixes

### F1: `is_liked` on logs
- [x] RED: `is_liked` true only when the viewer liked the log; false with no request/anonymous; no extra queries (uses prefetched `likes`)
- [x] `LogSerializer.is_liked` (viewer-relative, computed from `obj.likes.all()` in Python)
- [x] `logInfo.tsx`: `setLiked(data.is_liked)`; `types/log.ts` add `is_liked`; fix `types/like.ts` (`user: number`, `post: number`)
- Acceptance: reopening a liked log shows the filled heart
- Verify: `python manage.py test movie_csv.test_log_is_liked movie_csv.test_log_owner_username` · `npx tsc --noEmit` (no new errors vs 37 baseline) · `npx jest`
- Files: `movie_csv/serializers.py`, `movie_csv/test_log_is_liked.py` (new), `frontend/src/screens/logInfo.tsx`, `frontend/src/types/log.ts`, `frontend/src/types/like.ts` · Scope: M (5 files)

### F2: `UserSerializer` shows the display username
- [ ] RED: `GET /api/users/` rows show `display_username` / "Anonymous", never the Clerk id; constant query count
- [ ] `UserSerializer.username` uses `display_username`; `UserList` queryset `select_related("profile")`
- Acceptance: no Clerk id in `/api/users/` responses
- Verify: `python manage.py test movie_csv.test_user_list`
- Files: `movie_csv/serializers.py`, `movie_csv/views/api.py`, `movie_csv/test_user_list.py` (new) · Scope: S

## Phase 2: Watchlist

### F3a: Flag watchlists + one-watchlist-per-owner constraint
- [x] Read-only prod check for owners with more than one `"<username>'s Watchlist"` row: none (2 users, 2 watchlists, 0 duplicates, 0 flagged)
- [ ] RED: migration-function tests — flags the lowest-id `"<owner.username>'s Watchlist"` per owner (`is_watchlist=True`); leaves other lists and duplicates unflagged; reverse unflags; nothing renamed or deleted
- [ ] `RunPython` migration (reversible) then a partial `UniqueConstraint(fields=["owner"], condition=Q(is_watchlist=True))`
- Acceptance: each owner has at most one `is_watchlist=True` row; no data deleted or renamed
- Verify: `python manage.py test movie_csv.test_watchlist_migration` · `makemigrations --check` · migrate forward and backward on a copy of dev data
- Files: `movie_csv/models.py`, `movie_csv/migrations/0011_*.py`, `movie_csv/migrations/0012_*.py`, `movie_csv/test_watchlist_migration.py` (new) · Scope: M

### F3b: Look up and protect watchlists by `is_watchlist`; title from the display username
- [ ] RED: profile watchlist is found/created by `owner + is_watchlist=True` (no duplicates across repeated calls); `RemoveCollection` returns 403 only for `is_watchlist` and allows deleting a user list named "My Watchlist favorites"; watchlist `name` is `"<display username>'s Watchlist"` (plain "Watchlist" when the owner has none) and never contains the Clerk id; `is_watchlist: true` in responses
- [ ] `get_watchList`: `get_or_create(owner=..., is_watchlist=True, defaults={"name": "Watchlist"})`; `CollectionSerializer.name` derived for `is_watchlist` rows; `RemoveCollection` checks the flag
- [ ] `collectionInfo.tsx`: confirm delete/edit controls are hidden on the watchlist (already gated on `is_watchlist`)
- Acceptance: watchlist page title reads "<username>'s Watchlist" with no raw Clerk id and no delete/edit controls
- Verify: `python manage.py test movie_csv` · manual: open own watchlist and another user's list
- Files: `movie_csv/serializers.py`, `movie_csv/views/api.py`, `movie_csv/test_watchlist.py` (new) · Scope: S
- Depends on: F3a (same release)

### Checkpoint: Complete
- [ ] Full suite green; no raw Clerk id in any API response for other users
- [ ] Ready for review / PR

## For your review (no changes planned)

Dead-code list is in `tasks/plan-username-followups.md`. Nothing will be deleted without your say-so.
