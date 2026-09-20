# Spec: follow-feed

Map: `SPEC-follow.md`. Depends on: `follow-core` (`Follow` model).

## Objective

Give users a home feed of logs and reviews from the people they follow, so following has a visible payoff. Success: a "Following" section on home shows recent logs from followed users, with a useful empty state when the user follows nobody.

## Tech Stack

Existing Django/DRF + Expo. Reuse `LogSerializer` and existing log card components. Global pagination (10 per page). No new dependencies.

## Commands

```
cd backend
python manage.py test movie_csv.test_follow_feed

cd frontend
npm test
npx tsc --noEmit
npx expo export --platform web
```

## Project Structure

```
backend/movie_csv/views/api.py        FollowingFeed
backend/movie_csv/urls/api.py         path("feed/", ...)
backend/movie_csv/test_follow_feed.py new
frontend/src/api/logs.ts              fetchFollowingFeed
frontend/app/(home)/index.tsx         "Following" section
```

## Behavior

`GET /api/feed/` (auth required): `Log` rows where `owner` is in the viewer's followees, own logs excluded, ordered `-date, -id`, paginated, `select_related("essay", "owner")`, serialized with existing `LogSerializer`. Following nobody returns an empty `results` (200, not an error).

UI: additional section on home (not a replacement of the existing feed); infinite scroll, pull to refresh; empty state with a link to search ("Follow people to see their logs here").

Known limitation: `Log` has no timestamp, so ordering is day-granular with `-id` as tie-break. Not addressed here (ask first, see map).

## Code Style

```python
class FollowingFeed(generics.ListAPIView):
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = LogSerializer

    def get_queryset(self):
        followees = Follow.objects.filter(follower=self.request.user).values("followee_id")
        return (Log.objects.filter(owner_id__in=followees)
                .select_related("essay", "owner")
                .order_by("-date", "-id"))
```

## Testing Strategy

- Backend (`test_follow_feed.py`): only followed users' logs; own logs excluded; unfollowed users excluded; ordering `-date, -id`; pagination; empty for a user following nobody; unauthenticated rejected; constant query count as followed users/logs grow; unfollowing removes their logs from the feed.
- Frontend jest: renders logs, empty state with search link, requests next page on scroll end, refresh refetches.

## Boundaries

- **Always:** paginate; keep filtering server-side.
- **Ask first:** adding `Log.created_at` or changing feed ordering; including own logs; replacing the existing home feed.
- **Never:** fetch all logs and filter client-side; change `LogSerializer`'s shape for other endpoints.

## Success Criteria

- [ ] Feed contains exactly the followed users' logs, newest-first per the stated ordering.
- [ ] Empty state shown when following nobody; no error.
- [ ] Constant query count regardless of feed size.
- [ ] Follow then unfollow in the UI adds then removes that user's logs from the feed (manual end-to-end on web).
- [ ] Backend tests, jest, `expo export --platform web` pass; no new `tsc`/lint errors.
