# Implementation Plan: Sign up and log in with Google

Spec: `SPEC-google-signin.md`. Task list: `tasks/todo-google-signin.md`. Branch: `v2`.
The Clerk dev instance already has the Google SSO connection enabled (confirmed 2026-11-14), so
nothing is blocked on dashboard setup for development.

## Overview

Add "Continue with Google" above the form on `sign-in` and `sign-up`, via Clerk's `useSSO`
(`oauth_google`). Returning users go straight to `/`. Brand-new Google users land on a new
`choose-username` screen (Clerk requires a username; People search needs `display_username`) and
only get a session once they've picked one. Quitting that screen discards the attempt. No backend
change: `ClerkAuthentication` already provisions `User`/`Profile` from the token.

## Dependency graph

```
GoogleButton (shared) + /sso-callback route
    │
    ├── sign-in uses it ──────────────► returning user + email-link path   (T1)
    │
    ├── useUsernameAvailability hook ─► extracted from sign-up.tsx          (T2)
    │       │
    │       └── choose-username screen + new-user branch in GoogleButton    (T3)
    │
    └── sign-up uses it ──────────────► same button, same behaviour         (T4)

Native dev build verification ← needs T1-T4                                 (T5)
Production setup + beta checklist ← independent of code, needs T5 result    (T6)
```

## Architecture decisions

- **One component owns the SSO call.** `src/components/GoogleButton.tsx` holds `startSSOFlow`,
  the cancel-vs-new-user-vs-returning branching, error display and double-tap guard. `sign-in`
  and `sign-up` only render it, so the two screens can't drift.
- **Extract the username check into a hook (T2) rather than copy ~40 lines.** `sign-up.tsx`
  currently owns the debounce / stale-response-guard / suggestions logic. `choose-username` needs
  the identical behaviour. Extracting is a pure refactor guarded by the existing
  `sign-up.test.tsx` passing **unchanged**; if it can't pass unchanged, stop and tell Hillary
  rather than editing those tests.
- **Fail-fast ordering.** The two unverified assumptions (Clerk returns `missing_requirements`
  with `username` for a new Google user; `useSignUp()` on the next screen sees the same
  in-progress sign-up) are checked in T1's manual step, before building the screen that depends
  on them.
- **No backend or migration work.** If T1 shows the backend is involved after all (e.g. the
  Google `image_url` isn't landing in `Profile.imageUrl`), stop and revise the plan.
- **Discard on quit** is just "never call `setActive`"; no cleanup code.

## Phases

### Phase 1: Returning users (web) — T0, T1
Shared button, web popup callback, on `sign-in`. Ends with real Google accounts signing in on web
against the dev instance, and the new-user assumption confirmed or killed.

### Checkpoint A
Gates green; a Google account with an existing email/password account signs in as the **same**
Django user; the new-user `missing_requirements` + `username` assumption is confirmed.
**Human review before Phase 2.**

### Phase 2: New users — T2, T3, T4
Hook extraction, `choose-username`, button on `sign-up`.

### Checkpoint B
New Google user on web: tap → Google → pick username → home, with `display_username` set and
visible in People search. Quit mid-way leaves no Django user. Email/password untouched.

### Phase 3: Native and launch — T5, T6
Dev builds on iOS and Android; production Clerk/Google settings and beta checklist.

### Checkpoint C (done)
All six spec success criteria met on web, iOS, Android; ready for review/PR.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| New Google user doesn't come back as `missing_requirements` with `username` (dashboard setting, or Clerk auto-generates a username) | High: changes T3 entirely | Verified first in T1's manual step. If Clerk auto-generates one, the screen becomes "confirm/change username"; revise the plan. |
| `useSignUp()` on `choose-username` doesn't see the in-progress sign-up | High | Same T1 check. Fallback: pass nothing via router and rely on Clerk's shared client; if it fails, keep the flow in one component instead of a second route. |
| Existing email/password user signing in with Google creates a second Clerk user instead of linking | High (duplicate profiles) | T1 manual check compares Django `User.id` before and after. If it doesn't link, stop and ask (spec decision 3). |
| Web popup blocked or lands on an unmatched route | Medium | `startSSOFlow` called directly in the press handler; `sso-callback` route with `maybeCompleteAuthSession()` in T1. |
| Native redirect fails in Expo Go | Medium | Spec already requires a dev build; T5 uses `expo run:ios/android`. |
| Refactor of `sign-up.tsx` regresses the username check | Medium | T2 is refactor-only with existing tests unchanged. |
| Testers blocked by Google "access blocked" | Low (expected) | Testing-mode note + beta checklist in T6. |

## Parallelization

Mostly sequential: T1 gates everything. After Checkpoint A, T2 (hook extraction) and the
`choose-username` UI shell can overlap, but T3 depends on T2, and T4 on T1 only (it could run in
parallel with T2/T3). T6's Google Cloud/Clerk production setup is Hillary's and can start any time.

## Open questions

None blocking. Two things to decide when they come up: (a) if T1 shows accounts don't
auto-link, whether to block with a message or accept duplicates; (b) after T5, whether the "or"
divider/button styling needs a design pass.
