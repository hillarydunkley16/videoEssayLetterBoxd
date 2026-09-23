# Edit & Delete Own Logs — Task List

Plan: `tasks/plan-log-edit-delete.md`. Spec: `SPEC-log-edit-delete.md`. Branch: `v2`. Do in order; test first.

## Task 1: Backend — owner edit works, essay immutable  (S)
**Description:** Add tests for editing via `logDetail`, then make `LogSerializer` ignore `essay` on update.
**Acceptance criteria:**
- [x] Owner PATCH updates rating, review_text, date, rewatch → 200 and persisted
- [x] Owner PATCH with a different `essay` → 200, essay unchanged
- [x] Rating outside 0–5 → 400
- [x] Non-owner PATCH/DELETE → 403 (already covered in `test_owner_permissions.py`; not duplicated)
- [x] Log creation still requires `essay`
**Verification:**
- [x] `python manage.py test movie_csv.test_log_edit movie_csv.test_owner_permissions movie_csv.test_log_create`
- [x] `python manage.py test` (full suite)
**Dependencies:** None
**Files:** `backend/movie_csv/test_log_edit.py` (new), `backend/movie_csv/serializers.py`

## Task 2: `updateLog` + `logVideoModal` edit mode  (M)
**Description:** Add `updateLog()` to `src/api/logs.ts`. `logVideoModal` accepts `logId`; when present it loads the log, prefills the form, shows "Edit log" / "Save changes", PATCHes, then `router.back()` (fallback `router.replace('/')` if no history). Essay picture/title shown from the log's `essay_details`.
**Acceptance criteria:**
- [x] `/logVideoModal?logId=<id>` shows rating, review, date (no off-by-one day), rewatch pre-filled
- [x] Save sends one PATCH (no `essay`), including on double-tap
- [x] Failure shows inline error and stays editable
- [x] Create flow (`essayId`, quickLog) behaves exactly as before
**Verification:**
- [x] `npx jest "app/(modals)/__tests__/logVideoModal.test.tsx"` (existing Prove-It test + new edit-mode tests)
- [x] `npx tsc --noEmit` && `npm run lint`
**Dependencies:** Task 1
**Files:** `frontend/src/api/logs.ts`, `frontend/app/(modals)/logVideoModal.tsx`, `frontend/app/(modals)/__tests__/logVideoModal.test.tsx`, possibly `frontend/src/screens/createLogScreen.tsx`

### Checkpoint: after Tasks 1–2
- [x] Backend + frontend tests green; edit works via manual deep link on web
- [x] Review with human

## Task 3: Three-dots menu on the log page  (M)
**Description:** In `logInfo.tsx`, when `log.is_mine`, show a top-right ellipsis button opening a shared popover with **Edit** (→ `logVideoModal?logId=`) and **Delete** (confirm → `deleteLog` → `router.back()`). Reload the log on screen focus so edits show. Guard against double delete; show inline error on failure.
**Acceptance criteria:**
- [x] Non-owner sees no menu; owner sees it top-right
- [x] Edit opens the pre-filled modal; after saving, the log page shows the new values
- [x] Delete requires confirmation; confirmed delete removes the log and returns to the previous screen; cancel does nothing
- [x] Same behavior on web, iOS, Android (no platform-specific sheet)
- [x] Menu closes on outside press
**Verification:**
- [x] `npx jest src/screens/__tests__/logInfo.test.tsx` (owner vs non-owner, confirm-before-delete, single delete request)
- [x] `npx tsc --noEmit`, `npm run lint`
**Dependencies:** Task 2
**Files:** `frontend/src/screens/logInfo.tsx`, `frontend/src/screens/__tests__/logInfo.test.tsx`, optionally a small `frontend/components/ui/OverflowMenu.tsx`

## Task 4: Gates + manual verification  (S)
**Acceptance criteria:**
- [x] Full Django suite (309 OK), full jest (202 pass), `tsc --noEmit` (38 pre-existing errors, none new), eslint (no new errors), `npx expo export --platform web` all pass
- [ ] (left for user — needs a signed-in Clerk session) Manual: own log → edit each field → saved; delete → back; other user's log → no menu; direct 403 confirmed
**Dependencies:** Task 3

### Checkpoint: Complete
- [ ] All six acceptance criteria in the spec met; ready for review
