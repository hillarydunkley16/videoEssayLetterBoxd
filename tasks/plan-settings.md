# Implementation Plan: Settings Page (reachable from Profile)

Traces to `SPEC-settings.md`. Separate from `tasks/plan.md` (deploy plan, still open).
Task list: `tasks/todo-settings.md`. Branch: `v2`. Frontend commands run from `frontend/`.

## Overview

Add a Settings screen at `/(tabs)/settings`, opened by a gear icon in the own-profile
header. It hosts sign out, change password, change profile photo, and delete account.
Built as a thin screen over Clerk hooks (`useUser`, `useClerk`); the only backend work is
an account-delete endpoint for cleaning up Django data.

## Architecture Decisions

- **Custom thin screen over Clerk hooks, not `UserProfile`/`UserButton`.** Prebuilt UI is
  web-oriented in `@clerk/clerk-expo` 2.x; hooks work identically on web/iOS/Android.
  (Spec Open Question 3 — assumed OK; T0 spike confirms.)
- **Vertical slices, one action per task.** Each leaves the app working and shippable.
- **Route wrapper stays thin** (`app/(tabs)/settings.tsx` → `src/screens/SettingsScreen.tsx`),
  per CLAUDE.md conventions.
- **Photo logic is extracted, not copied**: `handleChangePhoto` moves to a shared helper
  used by both the profile avatar tap and Settings.
- **Delete order: Django data first, then Clerk `user.delete()`** (assumes Open Question 1
  option (b)). If the server call fails, nothing is deleted; if the Clerk call fails after
  the server delete, the user can retry (auth lazily recreates a `User`, so no dead state).
- **Delete-account slice is last and gated** on the Open Questions being answered, since it
  is the only backend/dashboard-dependent, irreversible piece.

## Dependency Graph

```
T0 spike (Clerk API check)
   └─ T1 gear → Settings shell + Sign out
        ├─ T2 Change photo (shared helper)
        ├─ T3 Change password
        └─ T4 Backend DELETE /api/account/   (independent of T2/T3; needs OQ1)
             └─ T5 Delete account UI (needs T1, T4, Clerk dashboard OQ2)
```

T2, T3, T4 are independent of each other after T1.

## Task List

### Phase 0: Verify assumptions
- [ ] T0: Spike — confirm Clerk hooks/APIs on installed version (no code committed)

### Phase 1: Entry + shell
- [ ] T1: Gear icon opens Settings page with Sign out

### Checkpoint: Shell
- [ ] tsc / lint / tests / web export pass; gear → settings → sign out works in browser

### Phase 2: Account actions
- [ ] T2: Change profile photo from Settings
- [ ] T3: Change password
- [ ] T4: Backend `DELETE /api/account/`

### Checkpoint: Actions
- [ ] All frontend gates + `python manage.py test` pass; T2/T3 manually verified

### Phase 3: Destructive
- [ ] T5: Delete account (confirm → server delete → Clerk delete → signed out)

### Checkpoint: Complete
- [ ] All SPEC-settings success criteria met; human review before merge

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Clerk self-deletion not enabled in dashboard | High (T5 fails) | T0 checks `user.delete` availability; user enables in Clerk dashboard before T5 |
| `user.updatePassword` unavailable / differs on native | Med | T0 spike; fall back to Clerk reset flow |
| OAuth users have no password | Med | Hide password section when `user.passwordEnabled` is false (OQ4) |
| Cascade delete removes more than expected | High | T4 tests assert exact cascade; review model FKs before writing |
| Partial failure in delete (server ok, Clerk fails) | Med | Ordering above; retry is safe; error shown inline |
| Removing header "Sign out" breaks existing ProfileScreen tests | Low | Update tests in T1 |

## Open Questions (from spec, still blocking)

1. Confirm delete option (b): new backend endpoint. **Blocks T4/T5.**
2. Enable Clerk self-deletion in dashboard. **Blocks T5.**
3. Confirm custom password form is acceptable if prebuilt UI isn't native-ready. **Assumed yes.**
4. Hide Change password for OAuth users? **Assumed yes.**
5. Remove duplicate `app/components/sign-out-button.tsx`? **Assumed out of scope.**
