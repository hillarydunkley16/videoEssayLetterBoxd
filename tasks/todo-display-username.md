# Todo: Show Clerk usernames for other users

Plan: `tasks/plan-display-username.md` · Spec: `SPEC-display-username.md`
Backend tests run from `backend/`; frontend gates from `frontend/`.

## Phase 1: Capture

### T0: Clerk claim + confirm claim name (manual, user)
- [ ] Add `"username": "{{user.username}}"` to the Clerk session token claims (same place `imageUrl`/`email` come from)
- [ ] Decode a real token and record the exact claim name
- [ ] Confirm the token still issues (custom claims share a ~1.2KB cookie budget) and note what an unset username yields (empty / null / missing)
- Acceptance: token payload contains the username claim
- Verify: decode the JWT (e.g. jwt.io or `python -c` with `jose.jwt.get_unverified_claims`)
- Files: none · Scope: XS

### T1: Store the username on auth
- [x] Write failing tests first (Prove-It)
- [x] `Profile.display_username` (CharField 150, null/blank, **no** unique) + migration `0012`
- [x] `ClerkAuthentication` saves claim to `Profile`
- Acceptance:
  - claim present → stored; changed claim → updated
  - claim missing → stored value untouched (never blanked)
  - unchanged claim → no `Profile` write
  - user with no Profile row is handled
- Verify: `python manage.py test movie_csv.test_authentication` · `python manage.py makemigrations --check --dry-run`
- Files: `users/models.py`, `users/migrations/0012_*.py`, `movie_csv/authentication.py`, `movie_csv/test_authentication.py` · Scope: M
- Depends on: T0 (claim name)

### Checkpoint: Capture
- [ ] Tests green, migration clean, real token populates `display_username`

## Phase 2: Show it

### T2: Follow lists + suggested users show usernames
- [ ] Add `display_username(user)` helper: `profile.display_username or "Anonymous"`
- [ ] `FollowListUserSerializer.username` uses it
- Acceptance: followers / following / suggested rows return the username; no username → `"Anonymous"`; query count unchanged (views already `select_related("profile")`)
- Verify: `python manage.py test movie_csv.test_follow_lists movie_csv.test_suggested_users`
- Files: `movie_csv/serializers.py`, `movie_csv/test_follow_lists.py`, `movie_csv/test_suggested_users.py` · Scope: S
- Depends on: T1

### T3: Other-user profile shows username
- [ ] `ProfileSerializer.get_user` uses the helper; **leave `get_watchList` naming alone**
- Acceptance: `user.username` in profile payload is the display username / `"Anonymous"`; `/otherProfile/[id]` title and `@handle` render it
- Verify: `python manage.py test movie_csv.test_profile_user_shape movie_csv.test_profile_follow_fields`; manual check on web
- Files: `movie_csv/serializers.py`, `movie_csv/test_profile_user_shape.py` · Scope: S
- Depends on: T2 (helper)

### Checkpoint: Follow surface
- [ ] `python manage.py test` green
- [ ] Two-account manual check: other user's name shows in sidebar, lists, profile
- [ ] Review with human

## Phase 3: Owners

### T4: Log and comment owners
- [ ] `LogSerializer.owner` and `CommentSerializer.user` use the helper (`owner_id` unchanged)
- [ ] Add viewer-relative `is_mine` to `LogSerializer` (`request.user == obj.owner`; `False` with no request)
- [ ] Pass `context={"request": request}` where `LogSerializer` is built manually (VideoInfo, `views/api.py:185`)
- [ ] `logInfo.tsx` uses `log.is_mine` instead of `parseInt(user.id)` (fixes "You" never showing); add `is_mine` to `types/log.ts`
- [ ] Add `select_related("owner__profile")` / `prefetch_related("comments__user__profile")` to log views (logList, userLogs, VideoInfo, logDetail as applicable)
- Acceptance: log/comment payloads show usernames; `is_mine` true only for the viewer's own logs; constant query count across N logs (`assertNumQueries`); `FollowingFeed` unaffected; own log detail shows "You"
- Verify: `python manage.py test movie_csv.test_log_create movie_csv.test_follow_feed movie_csv.test_popular_video_essays` plus new owner test; manual: own vs other user's log
- Files: `movie_csv/serializers.py`, `movie_csv/views/api.py`, `movie_csv/test_log_owner_username.py` (new), `frontend/src/screens/logInfo.tsx`, `frontend/src/types/log.ts` · Scope: M (5 files, at limit; split the frontend `is_mine` piece off if it grows)
- Depends on: T2

### T5: Collection owners + `is_owner`
- [ ] (Resolved) `user` in `collectionInfo.tsx` is Clerk `useUser()`; its id = Clerk `sub` = old `owner` string
- [ ] `CollectionSerializer.owner` uses the helper; add viewer-relative `is_owner` (`request.user == obj.owner`; `False` with no request). Do NOT expose the Clerk `sub`
- [ ] `ProfileSerializer.get_watchList` passes `context=self.context` to `CollectionSerializer`
- [ ] `collectionInfo.tsx` `isOwner` = `collection.is_owner`; add to `types/collection.ts`
- [ ] `select_related("owner__profile")` in collection views
- [ ] Leave watchlist `name` and `get_or_create` lookup untouched
- Acceptance: owner sees edit/delete on own collection (no regression); other users see username; watchlist not duplicated; query count constant
- Verify: `python manage.py test movie_csv` (collection tests) · manual: own vs other user's collection
- Files: `movie_csv/serializers.py`, `movie_csv/views/api.py`, `frontend/src/screens/collectionInfo.tsx`, `frontend/src/types/collection.ts`, `movie_csv/test_collection_owner.py` (new) · Scope: M
- Depends on: T2

## Phase 4: Verify

### T6: Frontend sweep + full gates
- [ ] Grep remaining raw-ID exposure (`log.owner`, `item.owner`, `@handle` in otherProfile) and fix stragglers
- Acceptance: no screen shows a Clerk `user_…` id for another user
- Verify: `python manage.py test` · `npx tsc --noEmit` · `npm run lint` · `npm test` · `npx expo export --platform web`
- Files: as needed (≤5) · Scope: S

### T7: Backfill command for users who haven't re-authed
- [ ] Management command `backfill_display_usernames` in `users/management/commands/`: pages Clerk Backend API `GET /users` (`limit=500`, `offset`), matches Clerk `id` to `User.username`, sets `Profile.display_username` where the Clerk username is non-empty (create Profile if missing)
- [ ] Idempotent; `--dry-run` flag; reads `CLERK_SECRET_KEY` from env only, errors clearly if unset
- [ ] Do NOT add the key to `render.yaml` (run once in the Render shell with the var set); no change to `test_render_blueprint.py`
- Acceptance: second run changes nothing; users missing in Clerk are skipped; existing values never blanked; Clerk API mocked in tests
- Verify: `python manage.py test users` (new test file, HTTP mocked) · `--dry-run` against the dev Clerk instance
- Files: `users/management/commands/backfill_display_usernames.py` (+ `__init__.py` files), `users/test_backfill_display_usernames.py` · Scope: S
- Depends on: T1
- Needs approval: new `CLERK_SECRET_KEY` (approved 2026-09-21)

### Checkpoint: Complete
- [ ] All `SPEC-display-username.md` success criteria met
- [ ] Backfill run in prod; People to follow shows no unexpected "Anonymous"

## Follow-up ticket (out of scope)
- [ ] Watchlist cleanup: data migration setting `is_watchlist=True` on `*'s Watchlist` rows + rename to "Watchlist"; `get_watchList` looks up by flag; `RemoveCollection` checks flag instead of `"Watchlist" in name`
- [ ] Clerk claim live in prod before deploy; expect "Anonymous" until users re-auth
- [ ] Ready for review / PR
