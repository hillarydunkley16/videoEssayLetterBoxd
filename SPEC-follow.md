# Capability Map: Follow

Index of the follower-functionality specs. Deployment spec stays in `SPEC.md`.
Plan: `tasks/plan-follow.md`. Tasks: `tasks/todo-follow.md`.

| Module id | Spec | Responsibility | Depends on |
|---|---|---|---|
| `follow-core` | `SPEC-follow-core.md` | `Follow` through-model + data migration; toggle endpoint; profile counts + `is_following`; debug-print cleanup | none |
| `follow-lists` | `SPEC-follow-lists.md` | Paginated followers/following endpoints; list screens; remove follower | `follow-core` |
| `follow-feed` | `SPEC-follow-feed.md` | Home feed of logs from followed users | `follow-core` |

Build order: `follow-core` -> `follow-lists`, `follow-feed` (independent).

## Shared context (applies to all modules)

**Users:** closed-beta members of the Expo app (web, iOS, Android). Following is one-directional (Letterboxd-style): no approval step, no private accounts.

**Stack (unchanged, no new dependencies):** Django + DRF (global `PageNumberPagination`, page size 10), Clerk auth via `ClerkAuthentication`, Expo/React Native with expo-router, jest-expo.

**Identity:** Django `User.username` is the Clerk user id. Endpoints use the Django integer `User.id` in URLs. Clients must not infer relationship state by comparing usernames; the backend supplies `is_following`.

## Decisions (defaults, confirmed by proceeding)

1. Module split as above.
2. "Remove follower" only: forcibly unfollows; the removed user may re-follow. **Blocking is out of scope.**
3. Own logs are excluded from the following feed.
4. Feed is an additional section on home, not a replacement.
5. `Log` has no timestamp; feed orders by `-date, -id`. Adding `created_at` is out of scope.

## Global boundaries

- **Always:** write the failing test first; keep viewer-relative fields (`is_following`) computed server-side; keep query counts constant regardless of list size; run `python manage.py test` and `npx tsc --noEmit` before finishing a task.
- **Ask first:** any additional schema change beyond those listed in `follow-core`; adding dependencies; adding `Log.created_at`; changing global pagination settings; adding notifications, discovery/suggestions, or blocking.
- **Never:** edit an applied migration; hardcode a host, issuer or secret; resolve the backend URL anywhere other than `frontend/src/api/client.ts`; remove or weaken a failing test to get green; delete the commented-out unfinished models/fields (`WatchList`, `display_username`, `Profile.photo`).

## Not now

Follow notifications, follow suggestions, blocking, private accounts / follow requests, `Log.created_at`.

## Open questions

None outstanding; override any decision above and the affected module spec gets updated first.
