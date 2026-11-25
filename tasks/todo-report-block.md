# Report and Block: Task List

Plan: `tasks/plan-report-block.md`. Spec: `SPEC-report-block.md`. Branch: `v2`.
Python: use `backend/.venv/bin/python`. Do tasks in order; write the failing test first; each task ends with its Verify step.

## Phase 1: Block (backend)
- [x] Task 1: `Block` model, migration, `blocked_user_ids` and `exclude_blocked` helpers
  - Acceptance: DB rejects duplicate and self blocks; helper symmetric; empty for anonymous; deleting either user removes the row
  - Verify: `users/test_block_model.py`; `makemigrations --check`; full suite
  - Files: `users/models.py`, 1 migration, test
- [x] Task 2: Block, unblock and blocked-list endpoints; follow severing; 403 on follow and comment across a block
  - Acceptance: block removes follows both ways and counts update; unblock does not restore follows; self 400; unknown 404; unauthenticated 401
  - Verify: `python manage.py test movie_csv.test_block`
  - Files: `views/api.py`, `urls/api.py`, `serializers.py`, test
- [x] Task 3: Hide blocked users' logs and comments; per-viewer like and comment counts
  - Acceptance: `logList`, `logDetail` (404), `VideoInfo`, `FollowingFeed`, nested comments clean in both directions; counts match what is shown; anonymous unchanged; `logList`/`logDetail` use `get_queryset()`; constant queries
  - Verify: `python manage.py test movie_csv.test_block_filtering`; existing log tests pass
  - Files: `views/api.py`, `serializers.py`, test
- [x] Task 4: Hide blocked users from people and list surfaces; per-viewer follower and following counts
  - Acceptance: `UserSearch`, `SuggestedUsers`, `FollowersList`, `FollowingList`, `CollectionList`, `CollectionSearch`, `CollectionDetail` (404), `ProfileDetailById` (404) hide blocked users both ways; profile counts and `is_following` exclude them
  - Verify: extend `test_block_filtering.py`; full suite

**Checkpoint A: backend suite green, `makemigrations --check` clean, block works via the API. Deployable alone.**

## Phase 2: Report (backend)
- [x] Task 5: `Report` model, endpoint, throttle, admin
  - Acceptance: report stored with snapshot; duplicate open report returns the existing one; own content 400; unauthenticated 401; daily cap; reporter and reported-user deletion keep the row; admin lists unresolved first with resolve and delete-content actions
  - Verify: `python manage.py test movie_csv.test_report`; extend `test_account_delete.py`; `makemigrations --check`
  - Files: `movie_csv/models.py`, migration, `views/api.py`, `urls/api.py`, `admin.py`, tests

## Phase 3: Frontend
- [ ] Task 6: Report UI: `safety.ts`, `ReportSheet`, "..." menu on log, comment, profile and list
  - Acceptance: submits once per tap; success and error states; no entry on own content; works on web
  - Verify: jest; `tsc --noEmit`; `expo lint`; manual on web
- [ ] Task 7: Block UI on other profiles
  - Acceptance: confirm step; on success navigate back and refresh feeds; blocked profile shows a neutral message
  - Verify: jest; manual: block, then user is gone from feed, search, suggestions
- [ ] Task 8: Blocked users screen in Settings
  - Acceptance: list, unblock, empty state
  - Verify: jest; manual unblock restores content but not follows

**Checkpoint B: all gates pass incl. `expo export --platform web`; report and block usable on web and a native build.**

## Phase 4: Policy and operations
- [ ] Task 9: Terms, Privacy and support: Claude drafts both, owner reviews; public routes; Settings links; agreement at sign-up (email and Google); support address from `EXPO_PUBLIC_SUPPORT_EMAIL`
  - Acceptance: URLs resolve on the web build; sign-up blocked until agreed; agreement recorded like the age confirmation
  - Verify: jest for the gate on both paths; `expo export --platform web`
  - Needs: owner review of the drafts before launch
- [ ] Task 10: Moderation runbook in `DEPLOY.md` and email on new reports
  - Acceptance: runbook covers review, content removal, user removal (Django and Clerk), 24-hour check; email behind a setting (off until a provider is chosen); send failure never fails the report
  - Verify: test with the locmem email backend; failure-path test
  - Ask first: choosing and creating an email provider account; `render.yaml` env additions
- [ ] Task 11: Device verification and App Review notes
  - Acceptance: report and block each content type on a physical device; hidden both ways; unblock; deleted-account cases; review notes describe the mechanisms and include a demo account
  - Verify: written checklist results appended here

## Notes
- Task 5: the `Report` CHECK is "at most one target", not "exactly one" as planned. The FKs are `SET_NULL` so a report survives its content being deleted, which leaves zero targets; "exactly one" would make deleting reported content fail. A `target_type` field (always set) records what the report was about.
- Tasks 1–5 verified: backend suite 426 passing, `makemigrations --check` clean (migrations `users/0014_block`, `movie_csv/0014_report`).
- Task 3/4 also covered `UserList` (not in the plan's baseline list) and per-viewer counts on `LikePost`/`FollowUser`/profiles.

## Open items
- Email provider (Task 10)
- Accept personal address as public support email, or use an alias
