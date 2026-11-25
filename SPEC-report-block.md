# Spec: Report and Block (`report-block`)

> Module of `SPEC-production-launch.md` (`trust-and-safety`) and a precondition of `SPEC-mobile-release.md`.
> Status: **APPROVED decisions, plan in `tasks/plan-report-block.md`, task list in `tasks/todo-report-block.md`.**

## Objective

Meet App Store guideline 1.2 (user-generated content) so the iOS app can pass review, and give users real tools against abuse: report content, block users, and have reports acted on within 24 hours. Verify the current wording of guideline 1.2 before submission.

**Users:** every signed-in user (report and block); the owner as moderator (admin and email).
**Out of scope:** automated text filtering (decided against), moderator UI beyond Django admin, appeals, shadow-banning, push notifications, private accounts.

## Decisions (final)

1. Blocking hides content **both ways** between the two users.
2. Blocking removes follows in both directions and stops the blocked user following or commenting on the blocker.
3. Follower, following, like and comment counts **exclude blocked users**, per viewer.
4. Reports cover logs, comments, users and lists; triaged in Django admin; each new report emails the support address.
5. No word filter. Report, block and admin removal are the filtering mechanism.
6. Support address is an env var (`SUPPORT_EMAIL` backend, `EXPO_PUBLIC_SUPPORT_EMAIL` app), never hardcoded; currently a personal address, replaced later.
7. Terms and Privacy are drafted by Claude and reviewed by the owner before launch.

## Commands

```
backend/.venv/bin/python manage.py makemigrations users movie_csv
backend/.venv/bin/python manage.py makemigrations --check
backend/.venv/bin/python manage.py test
backend/.venv/bin/python manage.py test movie_csv.test_block
backend/.venv/bin/python manage.py test movie_csv.test_block_filtering
backend/.venv/bin/python manage.py test movie_csv.test_report
cd frontend && npx tsc --noEmit && npm run lint && npm test && npx expo export --platform web
```

## Project structure

```
backend/users/models.py                  Block model, blocked_user_ids / exclude_blocked helpers
backend/movie_csv/models.py              Report model
backend/movie_csv/views/api.py           block, unblock, blocked list, report endpoints; filtering on content views
backend/movie_csv/urls/api.py            routes
backend/movie_csv/admin.py               Report, Block, Comment, Collection admin
backend/movie_csv/test_block*.py, test_report.py
frontend/src/api/safety.ts               report/block/unblock/list calls
frontend/src/components/ReportSheet.tsx  report bottom sheet (built on BottomSheet.tsx)
frontend/src/screens/BlockedUsersScreen.tsx
frontend/app/terms.tsx, privacy.tsx      public legal pages
DEPLOY.md                                moderation runbook
```

## API

| Method and path | Behavior |
|---|---|
| `POST /api/users/<id>/block/` | Idempotent; deletes follows both ways; 400 self, 404 unknown |
| `DELETE /api/users/<id>/block/` | Unblock; does not restore follows |
| `GET /api/users/blocked/` | The caller's blocks, paginated |
| `POST /api/reports/` | `{target_type, target_id, reason, details?}`; 400 own content; duplicate open report returns the existing one; daily cap per reporter |

Existing endpoints change: `FollowUser` and `CommentOnPost` return 403 across a block; content and people endpoints listed in the plan hide blocked users for signed-in viewers; blocked owner or profile returns 404.

## Code style

Match surrounding code. Backend: one helper for the block rule, no per-view re-implementations; DRF views with `ClerkAuthentication` and `IsAuthenticated`; tests one file per concern. Frontend: functional components, `@/` alias, theme tokens from `constants/theme`, route files thin and screens in `src/screens/`. Migrations are new files, never edited.

## Testing

- Backend: failing test first for every task; `assertNumQueries` on every filtered list; one test enumerating every surface in the plan's Baseline list; account-deletion tests for blocker, blocked, reporter and reported user.
- Frontend: jest for ReportSheet (submit, busy guard, error), menu visibility (not on own content), block confirm, blocked-users screen, terms gate on both sign-up paths.
- Gates before merge: backend suite, `makemigrations --check`, `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform web` with no new errors beyond the recorded baseline.
- Manual: physical-device pass in T11.

## Boundaries

- **Always:** apply block filtering through the shared helper; use `get_queryset()` rather than class-level querysets for anything viewer-dependent; keep the support address in env vars; run the gates before each commit.
- **Ask first:** the two schema changes (`Block`, `Report`) are pre-approved with the plan; anything else touching the schema, `render.yaml` email env vars, choosing an email provider or creating an account for one, running migrations against production.
- **Never:** hardcode the personal email address; edit applied migrations; present the drafted Terms or Privacy as legal advice; fail a report request because an email failed to send; reveal to a user that they were blocked.

## Success criteria

1. A user can report a log, comment, user or list from the app, once per target, and the report appears in admin and in the support inbox.
2. A user can block and unblock; blocked users are absent for both sides from feed, logs, comments, search, suggestions, follow lists, profiles and lists, and counts match what is visible.
3. Blocking severs follows and prevents following and commenting across the block.
4. Deleting any involved account leaves no errors and keeps reports as evidence.
5. Terms and Privacy are reachable by public URL and from Settings; sign-up requires agreement on email and Google paths.
6. The moderation runbook lets the owner act on a report within 24 hours.
7. All gates pass; the device pass in T11 is recorded; App Review notes describe the mechanisms.

## Open questions

1. Email provider for report notifications (needs an account; fits under $25/month). Until chosen, T10 ships with admin-only review and email behind a setting that is off.
2. Personal address is public in Terms, Privacy, Settings and App Store Connect until a dedicated address exists. Accepted or use an alias?
