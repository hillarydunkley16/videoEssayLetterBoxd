# Spec: follow-core

Map: `SPEC-follow.md`. Depends on: none.

## Objective

Make the follow relationship a single, consistent, efficiently-served piece of data. Today it is two independent M2Ms on `Profile` that the toggle view must keep in sync by hand, and every profile fetch embeds full follower/following user lists.

Success: one `Follow` row per relationship; profile responses carry counts and a viewer-relative `is_following`; the follow button renders correctly with no client-side identity matching.

## Tech Stack

Django + DRF (existing), SQLite dev / Postgres prod, Expo + jest-expo. No new dependencies.

## Commands

```
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py test movie_csv.test_follow_model
python manage.py test movie_csv.test_follow
python manage.py test                       # full suite

cd frontend
npm test
npx jest app/\(tabs\)/__tests__/otherProfile.test.tsx
npx tsc --noEmit
npm run lint
```

## Project Structure

```
backend/users/models.py                      Profile; M2M fields removed in Task 4
backend/movie_csv/models.py (or users/)      Follow model
backend/*/migrations/                        schema, data copy, M2M removal (new files only)
backend/movie_csv/serializers.py             ProfileSerializer (counts, is_following)
backend/movie_csv/views/api.py               FollowUser, ProfileDetail, ProfileDetailById
backend/movie_csv/test_follow_model.py       new: constraints + migration copy
backend/movie_csv/test_follow.py             existing: toggle behavior
frontend/src/types/profile.ts                Profile type
frontend/app/(tabs)/otherProfile/[id].tsx    follow button
frontend/src/screens/ProfileScreen.tsx       counts
```

## Behavior

**Model** `Follow`: `follower` FK User, `followee` FK User, `created_at` auto. `UniqueConstraint(follower, followee)`, `CheckConstraint(follower != followee)`, index on `followee`. Related names: `following_set` / `follower_set`.

**Migrations (new files only):**
A. create `Follow`. B. `RunPython` copy from `Profile.following` (source of truth per `FollowUser`); rows present only in `Profile.followers` are logged, not silently dropped; reverse is a no-op. C. (Task 4) remove `Profile.followers`/`following`.

**Toggle** `POST /api/users/<user_id>/follow/` (auth required): creates or deletes the `Follow` row. Response unchanged: `{"following": bool, "followers_count": int}`. 400 self-follow, 404 unknown user.

**Profile payload** (`/users/profile`, `/users/profile/<id>/`): remove `followers`, `following` lists; add `followers_count`, `following_count`, `is_following` (false on own profile). Remove the `print` calls in `ProfileDetail` and `ProfileDetailById`.

**Frontend:** `Profile` type updated; `otherProfile/[id].tsx` initialises from `is_following`/`followers_count`; `ProfileScreen.tsx` shows `followers_count`/`following_count`.

## Code Style

Match the surrounding code (flat views file, `APIView` classes, per-concern test files):

```python
class FollowUser(APIView):
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.id == user_id:
            return Response({"message": "Cannot follow yourself"}, status=400)
        target = get_object_or_404(User, id=user_id)
        follow, created = Follow.objects.get_or_create(follower=request.user, followee=target)
        if not created:
            follow.delete()
        return Response({"following": created,
                         "followers_count": Follow.objects.filter(followee=target).count()})
```

Frontend: PascalCase route components, thin `app/**` wrappers, API calls via `src/api/*` hooks, no new `console.log` noise.

## Testing Strategy

Backend Django tests, one file per concern (existing pattern), `force_authenticate` to bypass Clerk.
- `test_follow_model.py`: unique constraint, self-follow constraint, data-migration copy function (seeded rows, one-sided drift row).
- `test_follow.py`: follow, unfollow, count, self-follow 400, missing 404, unauthenticated rejected, repeated toggles.
- Profile view tests: new fields present, lists absent, `is_following` correct both ways, `assertNumQueries` constant across 1 vs 20 followers.
- Frontend jest: follow button initial state, toggle updates count, busy guard blocks double-tap, error path leaves state unchanged.
- Gates: full backend suite, `npm test`, no *new* `tsc`/lint errors (the repo has pre-existing ones tracked in `tasks/todo.md`).

## Boundaries

- **Always:** copy existing follows in the migration and test it; ship Tasks 4 and 5 in the same deploy.
- **Ask first:** dropping the old M2Ms in production before verifying the copy; any change to the toggle response shape.
- **Never:** edit migrations 0007/0008; leave the two representations half-migrated on `main`.

## Success Criteria

- [ ] Existing follows survive the migration (count before == count after in a seeded test).
- [ ] DB rejects duplicate and self follows.
- [ ] Toggle response shape is unchanged and both directions are covered by tests.
- [ ] Profile responses contain `followers_count`, `following_count`, `is_following` and no embedded user lists.
- [ ] Profile view query count does not grow with follower count.
- [ ] No follower-related `print` remains in the two profile views.
- [ ] Full backend suite and jest pass; no new `tsc`/lint errors; manual follow/unfollow works on `expo start --web`.
