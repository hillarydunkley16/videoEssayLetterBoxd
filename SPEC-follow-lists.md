# Spec: follow-lists

Map: `SPEC-follow.md`. Depends on: `follow-core` (the `Follow` model and `is_following` convention).

## Objective

Let a user see who follows a profile and who that profile follows, act on those rows, and remove their own unwanted followers. Success: tapping a follower/following count opens a paginated list where each row links to that user's profile and has a working follow toggle.

## Tech Stack

Existing Django/DRF + Expo. Reuse global `PageNumberPagination` (10 per page). No new dependencies.

## Commands

```
cd backend
python manage.py test movie_csv.test_follow_lists

cd frontend
npx jest src/screens/__tests__/FollowListScreen.test.tsx
npm test
npx tsc --noEmit
npx expo export --platform web
```

## Project Structure

```
backend/movie_csv/views/api.py            FollowersList, FollowingList, RemoveFollower
backend/movie_csv/serializers.py          FollowListUserSerializer
backend/movie_csv/urls/api.py             new routes
backend/movie_csv/test_follow_lists.py    new
frontend/src/api/users.ts                 fetchFollowers, fetchFollowing, removeFollower
frontend/app/(modals)/followList.tsx      thin route wrapper (reads params)
frontend/src/screens/FollowListScreen.tsx implementation
frontend/src/screens/ProfileScreen.tsx    counts become tappable
frontend/app/(tabs)/otherProfile/[id].tsx counts become tappable
```

## Behavior

**Endpoints** (all require auth):
- `GET /api/users/<id>/followers/` and `GET /api/users/<id>/following/`. Paginated envelope (`count`, `next`, `previous`, `results`), ordered by `-Follow.created_at`, then `-id`. Row: `{id, username, imageUrl, is_following}`, where `is_following` is relative to the *viewer* (false for the viewer's own row). 404 for unknown user.
- `DELETE /api/users/<id>/followers/<follower_id>/`: removes `Follow(follower=<follower_id>, followee=<id>)`. Only allowed when `<id>` is the requesting user; otherwise 403. 404 if the follow does not exist. 204 on success. Does **not** prevent re-following.

**UI:** `followList` route takes `userId` and `tab` (`followers|following`). Infinite scroll, empty state, row press navigates to `otherProfile/[id]` (own row goes to own profile), inline follow toggle updates that row in place. "Remove" action appears only on your own followers list.

## Code Style

```python
class FollowersList(generics.ListAPIView):
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = FollowListUserSerializer

    def get_queryset(self):
        get_object_or_404(User, id=self.kwargs["user_id"])
        return (User.objects
                .filter(following_set__followee_id=self.kwargs["user_id"])
                .select_related("profile")
                .order_by("-following_set__created_at", "-id"))
```

Viewer-relative flag computed by one extra query for the page's ids (or an `Exists` annotation), never per row.

## Testing Strategy

- Backend (`test_follow_lists.py`): ordering, pagination boundaries (page 2), `is_following` viewer-relative, own-row false, unknown user 404, unauthenticated rejected, constant query count (5 vs 25 rows), remove-follower permission matrix (owner 204, other user 403, no relationship 404, unauthenticated rejected), re-follow after removal succeeds.
- Frontend jest: both tabs render rows, pagination requests next page, row toggle updates only that row, Remove visible only on own followers list, empty state.

## Boundaries

- **Always:** paginate; compute `is_following` server-side; keep the removal check server-side.
- **Ask first:** changing page size for these endpoints; exposing extra user fields (email, etc.).
- **Never:** return unpaginated lists; expose email or other private fields; treat remove-follower as a block.

## Success Criteria

- [ ] Followers and following endpoints return correct, ordered, paginated rows for a seeded graph.
- [ ] Constant query count regardless of row count.
- [ ] Only the followee can remove a follower; counts and lists reflect removal immediately.
- [ ] Both profile screens open the correct list from their counts; toggling a row works.
- [ ] Backend tests, jest, `expo export --platform web` pass; no new `tsc`/lint errors.
