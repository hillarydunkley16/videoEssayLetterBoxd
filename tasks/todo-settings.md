# Settings Page — Task List

Plan: `tasks/plan-settings.md`. Spec: `SPEC-settings.md`. Branch: `v2`.
Frontend commands run from `frontend/`. Gates: `npx tsc --noEmit`, `npm run lint`,
`npm test`, `npx expo export --platform web`. Order: T0 → T1 → (T2, T3, T4) → T5.

---

## Task 0: Spike — confirm Clerk APIs on installed version  ✅ DONE (uncommitted)

**Description:** Read (don't change) `@clerk/clerk-expo` 2.19.x types to confirm
`user.updatePassword`, `user.passwordEnabled`, `user.delete`, `user.setProfileImage`
exist and whether `UserProfile` supports native. Record findings in this file.

**Acceptance criteria:**
- [x] Each API above confirmed present/absent, with the source file checked
- [x] Decision noted: custom password form vs. prebuilt UI

**Verification:**
- [x] Findings written under this task; no source changes (`git status` clean)

**Findings (Clerk 2.19.22):**
- `user.updatePassword({currentPassword, newPassword})`, `user.passwordEnabled`,
  `user.delete()`, `user.setProfileImage` all exist (`@clerk/shared` types).
- `UserProfile`/`UserButton` are exported only from `@clerk/clerk-expo/web` — no native
  support, so the custom password form is the right approach (OQ3 settled).
- Not verified: whether the Clerk dashboard allows self-deletion (blocks T5).

**Dependencies:** None
**Files likely touched:** none
**Estimated scope:** XS

---

## Task 1: Gear icon opens Settings page with Sign out  ✅ DONE (uncommitted)

**Description:** Replace the header "Sign out" text on own profile with a gear icon that
pushes `/(tabs)/settings`. Build `SettingsScreen` with a Sign out row and a back path;
turn the `settings.tsx` stub into a thin route wrapper; register it in the tabs Stack.

**Acceptance criteria:**
- [x] Own profile header shows a gear (`accessibilityLabel="Settings"`); `otherProfile` does not
- [x] Tapping it navigates to `/(tabs)/settings`; page has a working back control
- [x] Sign out on Settings calls `signOut()` then `router.replace("/")`
- [x] Old header "Sign out" removed

**Verification:**
- [x] Jest: gear shown/pushes route on own profile; Sign out calls `signOut` + replace
- [x] `tsc`, `lint`, web export pass
- [x] Manual (web): profile → gear → settings → sign out lands on `/` (confirmed by user)

**Dependencies:** T0
**Files likely touched:**
- `frontend/src/screens/ProfileScreen.tsx`
- `frontend/src/screens/SettingsScreen.tsx` (new)
- `frontend/app/(tabs)/settings.tsx`
- `frontend/app/(tabs)/_layout.tsx`
- `frontend/app/(tabs)/__tests__/settings.test.tsx` (new)

**Estimated scope:** Medium

---

## Checkpoint: After T1
- [x] All frontend gates pass
- [x] Gear → Settings → Sign out works end-to-end in browser
- [ ] Review with human before proceeding

---

## Task 2: Change profile photo from Settings  ✅ DONE (uncommitted)

**Description:** Extract `handleChangePhoto` from `ProfileScreen` into a shared helper/hook
and add a "Change profile photo" row on Settings. Avatar tap on profile keeps working.

**Acceptance criteria:**
- [x] Settings row picks an image, calls `user.setProfileImage`, then `updateProfileImageAPI`
- [x] Profile avatar tap still works via the same helper (no duplicated logic)
- [x] Cancelled picker is a no-op; failure shows an inline error

**Verification:**
- [x] Jest: helper calls setProfileImage + API on success, nothing on cancel
- [x] Manual: photo changes and persists after reload (confirmed by user)
- [x] Gates pass

**Dependencies:** T1
**Files likely touched:**
- `frontend/src/screens/SettingsScreen.tsx`
- `frontend/src/screens/ProfileScreen.tsx`
- `frontend/src/hooks/useChangeProfilePhoto.ts` (new)
- tests

**Estimated scope:** Medium

---

## Task 3: Change password  ✅ DONE (uncommitted)

**Description:** Add a Change password form (current, new, confirm) on Settings using
`user.updatePassword`. Hidden when `user.passwordEnabled` is false.

**Acceptance criteria:**
- [x] Submit blocked on empty fields or mismatched confirm
- [x] Success calls `updatePassword({currentPassword, newPassword})` and shows confirmation
- [x] Clerk error (e.g., wrong current password) shown inline; password never logged
- [x] Section hidden for users without a password

**Verification:**
- [x] Jest: validation, success, error, hidden-when-no-password
- [x] Manual: wrong current password errors; correct one succeeds (confirmed by user)
- [x] Gates pass

**Dependencies:** T1
**Files likely touched:**
- `frontend/src/screens/SettingsScreen.tsx`
- `frontend/src/screens/ChangePasswordForm.tsx` (new)
- tests

**Estimated scope:** Medium

---

## Task 4: Backend `DELETE /api/account/`  ✅ DONE (uncommitted)

**Description:** Authenticated endpoint that deletes the requesting user's Django `User`
(cascading `Profile`, logs, likes, comments, collections). Requires answer to spec OQ1.

**Acceptance criteria:**
- [x] Unauthenticated → 401; authenticated deletes only the caller's data
- [x] Other users' data untouched; follower relations to the user cleaned up
- [x] Returns 204; idempotent-safe on retry (user recreated lazily by auth, then deleted)
- [x] No migration needed (or a new one, never edit applied ones)

**Verification:**
- [x] `python manage.py test movie_csv.test_account_delete` (new, per-concern file)
- [x] `python manage.py test` full suite; `python manage.py check`

**Notes:**
- Essays the caller added (`VideoEssay.owner`, CASCADE) are handed to another user who
  logged or listed them before the delete, so other users' logs/lists survive. No schema change.
- Unauthenticated test accepts 401 or 403 (DRF returns whichever the auth class implies);
  not verified against a real Clerk-token request.
- Backend suite: 234 tests OK (228 baseline + 6 new). Use `backend/.venv/bin/python`.

**Dependencies:** T1 not required; blocked on OQ1
**Files likely touched:**
- `backend/movie_csv/views/api.py`
- `backend/movie_csv/urls/api.py`
- `backend/movie_csv/test_account_delete.py` (new)

**Estimated scope:** Small

---

## Checkpoint: After T2–T4
- [x] Frontend gates + backend suite pass
- [x] Photo and password verified manually
- [ ] Review with human before the destructive task

---

## Task 5: Delete account UI  ✅ DONE (uncommitted)

**Description:** "Delete account" section on Settings with an explicit confirmation step
(type username). Confirmed flow: call `DELETE /api/account/`, then `user.delete()`, then
route to `/` signed out. Requires Clerk self-deletion enabled in dashboard.

**Acceptance criteria:**
- [x] Nothing is deleted until confirmation matches the username
- [x] Order: server delete first; Clerk delete only if it succeeded
- [x] Failure at either step shows an inline error and leaves the user signed in
- [x] Success lands on `/` signed out

**Verification:**
- [x] Jest: no calls before confirm; call order; error paths
- [x] Manual with a throwaway dev-instance account: account gone in Clerk dashboard and DB (confirmed by user)
- [x] All gates + backend suite pass

**Notes:** Clerk self-deletion toggle confirmed on (incl. "apply to existing users"). Jest 73/73, tsc 38 (all pre-existing), lint clean, web export OK. Manual delete check confirmed by user.

**Dependencies:** T1, T4; Clerk dashboard OQ2
**Files likely touched:**
- `frontend/src/screens/SettingsScreen.tsx`
- `frontend/src/api/account.ts` (new; uses `client.ts`)
- tests

**Estimated scope:** Medium

---

## Checkpoint: Complete
- [x] All `SPEC-settings.md` success criteria met (manual checks confirmed by user, incl. other users' logs surviving a delete)
- [ ] Human review before merge
