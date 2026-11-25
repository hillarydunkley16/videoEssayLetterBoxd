# Spec: Show Clerk usernames for other users

## Objective

The backend stores the Clerk `sub` (e.g. `user_2abc…`) as `User.username`, so every place that shows *another* user's name (People to follow, followers/following lists, other-user profile) shows a raw Clerk ID. The signed-in user's own name looks fine only because `ProfileScreen` reads it from Clerk on the client.

Fix: capture the user's **Clerk username** on the backend at authentication time, store it on `Profile`, and return it wherever another user's name is displayed.

**Users:** beta users browsing other people's profiles and follow lists.
**Not** first/last name — the Clerk username only (decision, 2026-09-21).

## Assumptions (correct me if wrong)

1. Clerk custom session-token claims already carry `imageUrl`/`email`; adding a `username` claim works the same way (dashboard config, not code).
2. Most users have a Clerk username (sign-up collects one). Users without one (e.g. OAuth) keep showing the raw ID for now.
3. `User.username` must remain the Clerk `sub` — it is the auth lookup key and must not change.
4. Names refresh only when that user next makes an authenticated request; acceptable for a closed beta.

## Tech Stack

Django/DRF backend (SQLite dev, Postgres prod), `python-jose` JWT verification, Expo/React Native frontend (jest-expo). No new dependencies.

## Commands

```
cd backend
python manage.py makemigrations users
python manage.py migrate
python manage.py test movie_csv.test_authentication
python manage.py test movie_csv.test_follow_lists movie_csv.test_profile_user_shape movie_csv.test_suggested_users
python manage.py test
cd ../frontend
npx tsc --noEmit && npm run lint && npm test
```

## Project Structure

```
backend/users/models.py                    → Profile.display_username field
backend/users/migrations/0012_*.py         → new migration (never edit applied ones)
backend/movie_csv/authentication.py        → read `username` claim, save to Profile
backend/movie_csv/serializers.py           → helper + FollowListUserSerializer, ProfileSerializer.get_user
backend/movie_csv/views/api.py             → select_related("profile") on follow-list / suggested-user querysets
backend/movie_csv/test_*.py                → per-concern tests
frontend/src/screens/FollowListScreen.tsx, frontend/app/(tabs)/otherProfile/[id].tsx → verify only
```

## Design

- **Model:** `Profile.display_username = CharField(max_length=150, null=True, blank=True)` (uncomment/adapt the existing stub). **No unique constraint**: Clerk enforces uniqueness; a DB constraint could turn a cross-instance collision (dev vs prod Clerk) into an `IntegrityError` that blocks login.
- **Auth:** `username = payload.get("username")`. If present and different from the stored value, update `Profile`. Skip the write when unchanged or claim absent (never blank out a stored name because a token lacked the claim). Backfills existing users on next request.
- **Serialization:** one helper, `display_username(user)` → `profile.display_username or user.username`. The existing `username` key in responses carries this value, so the response shape and frontend types are unchanged.
- **Clerk dashboard (manual):** add `"username": "{{user.username}}"` to session token claims. Must go live before/with the backend deploy; if late, behavior is identical to today (fallback to ID).

## Code Style

Match surrounding code: flat `views/api.py`, `SerializerMethodField` for computed values, per-concern test files with Django `TestCase`.

```python
def display_username(user):
    profile = getattr(user, "profile", None)
    return (profile.display_username if profile else None) or user.username
```

## Testing Strategy

Backend Django tests, test-first (Prove-It). No new frontend tests: payload shape is unchanged.

- `test_authentication.py`: claim populates `Profile.display_username`; changed claim updates it; missing claim leaves stored value; unchanged claim causes no `Profile` write; user with no profile row is handled.
- Follow-list / suggested-users / profile API tests: `username` returns the display username; falls back to Clerk ID when unset; query count stays constant (no N+1).

## Boundaries

- **Always:** tests first; add a new migration; keep `User.username` = Clerk `sub`; keep response keys stable.
- **Ask first:** touching log/collection/comment `owner`/`user` serializers (see open questions); adding a unique constraint; any Clerk Backend API call or `CLERK_SECRET_KEY`.
- **Never:** change `User.username` for existing users; edit applied migrations; hardcode Clerk values; blank a stored name from a missing claim.

## Success Criteria

- [ ] With the claim present, People to follow, followers, following, and other-user profile return the Clerk username, not the `sub`.
- [ ] Existing users are backfilled on their next authenticated request.
- [ ] Missing claim → fallback to current behavior (no crash, no data loss).
- [ ] No extra DB write per request when the name is unchanged; follow-list query counts unchanged.
- [ ] `manage.py test`, `tsc --noEmit`, `expo lint` all pass.

## Decisions (2026-09-21)

1. Users with no Clerk username show **"Anonymous"** (not the raw ID). The helper is `profile.display_username or "Anonymous"`; this supersedes the `or user.username` fallback above and the "falls back to Clerk ID" test wording.
2. Log, comment, and collection `owner`/`user` fields are **in scope**. `CollectionSerializer.owner` is compared to the Clerk id in `collectionInfo.tsx` (`isOwner`), so that check must move to an id field. `get_watchList` naming stays untouched.

3. `CollectionSerializer` and `LogSerializer` gain viewer-relative `is_owner` / `is_mine` booleans (like `is_following`); the frontend uses them instead of comparing owner strings to the Clerk id. This also fixes the existing always-false `isMine` in `logInfo.tsx`.
4. Watchlist naming (`get_watchList`, `RemoveCollection` name check) is left as-is; cleanup is a separate follow-up.
5. A one-off backfill command (T7) populates `display_username` for users who haven't re-authed. Approved: new `CLERK_SECRET_KEY`, set only in the Render shell for the run, not in `render.yaml`.

## Open Questions

1. Decode a real session token to confirm the claim is named `username`, that the token still issues (~1.2KB custom-claim budget), and what an unset username yields.
