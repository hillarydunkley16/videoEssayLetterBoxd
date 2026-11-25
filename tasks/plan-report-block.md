# Implementation Plan: Report and Block (App Store guideline 1.2)

Status: **DECISIONS MADE, awaiting plan approval.** No code changed. Earlier open questions are resolved (see Decisions log). No `SPEC-report-block.md` exists yet; fold the decisions into one on approval.
Task list (to write on approval): `tasks/todo-report-block.md`.
Context: `SPEC-mobile-release.md` precondition "Report/block/remove UGC in-app", `SPEC-production-launch.md` module `trust-and-safety`.

## Overview

Apple requires apps with user-generated content to provide: (1) a way to report content, (2) a way to block abusive users, (3) a method for filtering objectionable material, (4) published contact info, and (5) a commitment to act on reports within 24 hours. Users must also agree to terms that forbid objectionable content. This plan covers all five. Verify the current wording of guideline 1.2 before submission.

User-generated content in this app: log reviews (`Log.review_text`), comments (`Comment.text`), list names (`Collection.name`), usernames and profile photos.

## Baseline facts (verified in the repo)

- `users.Follow` exists (unique pair, no self-follow). `Profile` is 1:1 with `User`. `Comment` has `user`, `log`, `text` (200 chars) and a `date` (no time).
- Every content list is a separate view in `movie_csv/views/api.py` with its own queryset. Several use a **class-level** `queryset = with_log_relations(...)` (`logList`, `logDetail`), so they cannot see the viewer; they need `get_queryset()`.
- Surfaces that show other users' content: `logList`, `logDetail`, `VideoInfo` (public, `AllowAny`, returns every log of a video), `FollowingFeed`, `userLogs` (own only), `LogSerializer.comments` (nested), `CollectionList` (public), `CollectionDetail`, `CollectionSearch`, `UserSearch`, `SuggestedUsers`, `FollowersList`/`FollowingList`, `ProfileDetailById`.
- Frontend: log detail with comment composer in `src/screens/logInfo.tsx`; other-user profile in `app/(tabs)/otherProfile/[id].tsx`; list detail in `src/screens/collectionInfo.tsx`; reusable `src/components/BottomSheet.tsx`; settings in `src/screens/SettingsScreen.tsx` (no legal links today); age checkbox in `src/components/AgeConfirmation.tsx`.
- Account deletion cascades from the Django `User`, so new tables must not leave orphan or blocking rows (see T1, T5).
- Tests are Django's runner, one file per concern, run with `backend/.venv/bin/python manage.py test`. Migrations are committed and never edited after applying.

## Design decisions (proposed)

1. **Block is mutual in effect.** If A blocks B, A no longer sees B's content and B no longer sees A's. This avoids B seeing A's content or interacting with A, and keeps the rule in one helper. B is not told.
2. **Blocking also severs follows** in both directions and prevents B from following A or commenting on A's logs (403).
3. **One helper** (`blocked_user_ids(viewer)` returning the set of ids blocked in either direction) plus one queryset filter used by every surface. No view re-implements the rule. Anonymous viewers see unfiltered content (there are no blocks to apply).
4. **Report targets:** a log, a comment, a user, or a list. One `Report` table with one nullable FK per target type and a CHECK that exactly one is set. FKs are `SET_NULL` and the row stores a text snapshot, so the report survives deletion of the content (evidence) and deleting a reporter's account does not delete the report.
5. **Reports are triaged in Django admin** (no new moderator UI). Removing content = delete in admin; removing a user = delete the Django user and the Clerk user. Admin shows unresolved reports first.
6. **24-hour commitment** is met by an email to the support address on every new report plus a documented daily admin check (T10). The address comes from a `SUPPORT_EMAIL` env var (never hardcoded), so it can move from the personal address to a dedicated one later without a code change.
7. **Reporting is deduplicated and rate limited:** one open report per (reporter, target); a cap per reporter per day.
8. **Filtering (guideline 1.2 item 3)** is handled by report + block + admin removal. No term filter (decided). If App Review pushes back on item 3, a blocklist check can be added later.
9. **Counts exclude blocked users** (decided): follower, following, like and comment counts, and `likes_count`/`comments` on logs, are computed per viewer, not globally.

## Dependency graph

```
T1 Block model + helper
 ├─ T2 Block/unblock endpoints (+ follow severing)
 │   ├─ T3 Filter log and comment surfaces
 │   └─ T4 Filter people and list surfaces
 │        └─ T7 Block UI on profile ── T8 Blocked users screen
 └─ (independent) T5 Report model + endpoint + admin
      └─ T6 Report UI (sheet + entry on log/comment/profile/list)
T9 Terms/privacy/support + agreement at sign-up   (independent, needs legal text)
T10 Moderation runbook + report email             (after T5)
T11 Device verification + review notes            (last)
```

## Phase 1: Block (backend)

### T1: `Block` model and viewer helper (S)
- `users.Block(blocker, blocked, created_at)`; unique `(blocker, blocked)`; CHECK `blocker != blocked`; both FKs `CASCADE` (account deletion removes rows both ways); index on `blocked`.
- `blocked_user_ids(viewer)`: ids blocked in either direction; empty set for anonymous.
- `exclude_blocked(queryset, viewer, field)` applying `~Q(field__in=...)` using a subquery, not a Python list, to stay one query.
- Acceptance: DB rejects duplicates and self-blocks; helper is symmetric; deleting either user removes the row.
- Verify: `users/test_block_model.py` written first; `makemigrations --check`; full suite.
- **Ask-first item (schema change): approved with the plan.**

### T2: Block and unblock endpoints (M)
- `POST /api/users/<id>/block/` (idempotent; deletes `Follow` rows both ways in one transaction), `DELETE /api/users/<id>/block/`, `GET /api/users/blocked/` (the viewer's own blocks, paginated, with profile fields).
- Reject blocking self (400) and unknown user (404). `FollowUser` returns 403 if either side blocks the other. `CommentOnPost` returns 403 if the log owner and commenter have a block.
- Acceptance: block removes follows and follower counts update; blocked user cannot follow or comment; unblock does not restore follows.
- Verify: `movie_csv/test_block.py` covering each case, unauthenticated rejected, and the query count of the list.

### T3: Hide blocked users' logs and comments everywhere (M)
- Convert `logList` and `logDetail` from class-level `queryset` to `get_queryset()`; extend `with_log_relations(qs, viewer=None)` to filter the owner and to `Prefetch` comments with blocked authors excluded.
- Apply to `logList`, `logDetail` (blocked owner => 404), `VideoInfo` logs and `log_count`, `FollowingFeed`, and the nested comments in `LogSerializer`.
- Likes: `likes_count` and `is_liked` exclude likes from blocked users for the viewer; comment counts exclude their comments.
- Acceptance: for a viewer with a block either way, none of those responses contain the other user's logs or comments; like and comment counts match what is shown; anonymous responses unchanged.
- Verify: `movie_csv/test_block_filtering.py` with an `assertNumQueries` guard so the filter adds no per-row queries; existing log tests still pass.

### T4: Hide blocked users from people and list surfaces (M)
- Apply `exclude_blocked` to `UserSearch`, `SuggestedUsers`, `FollowersList`, `FollowingList`, `CollectionList`, `CollectionSearch`, `CollectionDetail` (blocked owner => 404), and `ProfileDetailById` (blocked => 404). Follower and following counts, and `followers_count`/`following_count`/`is_following` on profiles, exclude blocked users for the viewer.
- Acceptance: a blocked user is not findable, suggestible, listed, or viewable by the blocker or vice versa.
- Verify: extend `test_block_filtering.py`; full suite.

**Checkpoint A:** backend suite green, `makemigrations --check` clean, block works end to end via the API. Deployable on its own (no UI yet).

## Phase 2: Report (backend)

### T5: `Report` model, endpoint, admin (M)
- `movie_csv.Report(reporter, reason, details, log, comment, reported_user, collection, snapshot, status, created_at, resolved_at, resolution_note)`; reasons: spam, harassment, hate, sexual content, violence, other. CHECK exactly one target; FKs `SET_NULL`; reporter `SET_NULL`.
- `POST /api/reports/` with `{target_type, target_id, reason, details?}`; validates the target exists, rejects reporting your own content, dedupes open reports per (reporter, target), caps reports per reporter per day (use DRF throttling, consistent with the existing limiter settings).
- Admin: register `Report` (filter by status, reason; unresolved first; actions: mark resolved, delete reported content), `Block`, `Comment`, `Collection`.
- Acceptance: valid report stored with snapshot; duplicate returns the existing report (200); self-report 400; unauthenticated 401; reporter deletion keeps the row.
- Verify: `movie_csv/test_report.py`; `test_account_delete.py` extended for reporter and reported-user deletion.
- **Ask-first item (schema change): approved with the plan.**

## Phase 3: Frontend

### T6: Report UI (M)
- `src/api/safety.ts` (`reportContent`, `blockUser`, `unblockUser`, `fetchBlockedUsers`) built on the existing `authPost`/`authDelete` hooks.
- `src/components/ReportSheet.tsx` on the existing `BottomSheet` (works on web, where `Alert.alert` does not): reason list, optional details, submit, confirmation, error state, double-tap guard.
- Entry points via a "..." menu with Report: log detail and feed rows, each comment, other-user profile, list detail. Hidden on your own content.
- Acceptance: report submits once per tap; success and failure states shown; no entry on own content.
- Verify: jest tests for the sheet (submit, busy guard, error) and for the menu visibility; `tsc --noEmit`; `expo lint`; manual on web.

### T7: Block UI on other profiles (S)
- "Block user" in the profile menu with a confirm step that explains the effect; on success navigate back and refresh feeds. Blocked-state profile (404) shows a neutral "unavailable" message.
- Verify: jest (confirm, success, error); manual: block from a profile, confirm the user disappears from feed, search and suggestions.

### T8: Blocked users screen (S)
- `Settings > Blocked users` listing blocks with Unblock. Empty state.
- Verify: jest; manual unblock restores visibility of content but not follows.

**Checkpoint B:** web export builds, gates pass (`tsc`, lint, jest, `expo export --platform web`), report and block usable on web and a native build.

## Phase 4: Policy and operations

### T9: Terms, privacy, support and agreement (M)
- Static routes in the Expo app (e.g. `app/terms.tsx`, `app/privacy.tsx`) so they have public URLs on web, plus a support email in Settings and on the sign-in screen, read from `EXPO_PUBLIC_SUPPORT_EMAIL` (the personal address must not be committed to source). **I draft both documents** from what the app actually does (accounts through Clerk, Google sign-in, logs/reviews/comments/lists, YouTube links via SerpAPI, age confirmation, account deletion, hosting on Render and Supabase). The drafts need your review, ideally a lawyer's, before launch. Terms must state no tolerance for objectionable content or abusive users and that reports are acted on within 24 hours.
- Extend the existing sign-up age check (`AgeConfirmation.tsx`, `useAgeConfirmationSync`) so users also agree to the Terms and Privacy Policy before creating an account (email and Google paths), and record that agreement the way the age confirmation is recorded.
- Add Settings links to Terms, Privacy and Support.
- Verify: jest for the agreement gate on both sign-up paths; the URLs resolve on the web build.

### T10: Moderation runbook and notification (S)
- `DEPLOY.md` section: how to review reports in admin, remove content, remove a user (Django + Clerk), and the 24-hour check.
- Email on each new report to `SUPPORT_EMAIL` via Django's email backend. Needs an SMTP provider and credentials in Render env vars (`EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`) as `sync: false` entries in `render.yaml`. Provider choice is open (see Open questions). A send failure must never fail the report request.

### T11: Device verification and review notes (S)
- Physical-device pass: report and block each content type, confirm hidden both ways, unblock, deleted-account edge cases. Add the moderation description (report, block, 24-hour removal, contact) and a demo account to the App Store review notes.

## Risks

| Risk | Mitigation |
|---|---|
| A surface is missed and still shows blocked content | One helper; `test_block_filtering.py` enumerates every surface from the Baseline list; add a test whenever a new content endpoint is added |
| Class-level querysets can't see the viewer | Convert to `get_queryset()` in T3 and add a regression test |
| Filtering adds queries per row | Subquery filter plus `assertNumQueries` guards |
| `VideoInfo` is public (`AllowAny`) but must filter for signed-in viewers | Auth is optional there; use the viewer when present and test both |
| Report spam or abuse of reporting | Dedupe plus daily cap |
| Legal text is wrong | You review it; not generated as final |
| Per-viewer counts add queries or break caching | Annotate with filtered subqueries; `assertNumQueries` guards in T3/T4 |

## Decisions log

1. Block direction: both ways.
2. Reports: email to the support address (an env var). The support address is currently a personal one; a dedicated address comes later.
3. Counts exclude blocked users (follower, like, comment).
4. No word filter; report, block and removal are enough.
5. Support email: personal for now, replaced later via env var.
6. Terms and Privacy: drafted by me, reviewed by you.

## Open questions

1. **Email provider** for report notifications. It needs an account and credentials and has to fit the under-$25/month budget. Until chosen, T10 can ship with admin-only review and the email wired behind a setting that is off by default.
2. **Personal address exposure:** the support address is shown publicly in Terms, Privacy, Settings and App Store Connect. Using the personal one makes it public until the dedicated address exists. Confirm that is acceptable, or use a forwarding alias.

## Effort and order

Rough size: 5 S, 6 M, no L. Order: T1 to T4 (Checkpoint A) and T5 in parallel, then T6 to T8 (Checkpoint B), then T9 to T11. T9 can start anytime if the legal text is ready, since it blocks submission.
