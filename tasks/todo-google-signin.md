# Google Sign-in — Task List

Plan: `tasks/plan-google-signin.md`. Spec: `SPEC-google-signin.md`. Branch: `v2`.
Frontend commands from `frontend/`. Gates: `npx jest`, `npx tsc --noEmit`, `npm run lint`,
`npx expo export --platform web`. Backend is not expected to change.

"No new errors" means: tsc stays at 0 errors, lint stays at 0 errors (warnings should not rise above 231), and test
counts only go up.

---

## Phase 1 — Returning users (web)

### T0: Record the baseline  ✅ DONE
- [x] Run all four frontend gates on `v2` and write the numbers into this file
- Acceptance: baseline table filled in below
- Verify: the commands above · Files: this file · Scope: XS

| Gate | Result |
|---|---|
| `npx jest` | 43 suites, 298 tests passed |
| `npx tsc --noEmit` | 0 errors (exit 0) |
| `npm run lint` | 0 errors, 231 warnings |
| `expo export --platform web` | succeeds |

### T1: Shared Google button + web callback, on `sign-in`  ✅ CODE DONE (manual 1-4 pending)
- [x] Tests first (mock `@clerk/clerk-expo` `useSSO`, `expo-router`): button calls `startSSOFlow({ strategy: 'oauth_google' })` with no `redirectUrl`; `createdSessionId` → `setActive` then `router.replace('/')`; `authSessionResult.type !== 'success'` (cancel) → no navigation, no error; thrown error → `getClerkErrorMessage` text shown; two quick taps start one flow; button renders above the email form with an "or" divider
- [x] `src/components/GoogleButton.tsx`: owns the SSO call and the three branches (returning / new / cancel). New-user branch is a stub here (`TODO T3`); log `signUp.status` and `signUp.missingFields` **temporarily**
- [x] `app/sso-callback.tsx` (web popup landing route) calling `WebBrowser.maybeCompleteAuthSession()`; module-level call also in the button file; `warmUpAsync` on native only
- [x] Render the button on `app/(auth)/sign-in.tsx` above the form with an "or" divider
- Acceptance: unit tests pass; existing sign-in behaviour unchanged; `startSSOFlow` is invoked synchronously from the press handler (no `await` before it, popup blockers)
- Verify: `npx jest "app/(auth)"` then full gates vs T0 baseline
- Files: `src/components/GoogleButton.tsx`, `app/sso-callback.tsx`, `app/(auth)/sign-in.tsx`, `src/components/__tests__/GoogleButton.test.tsx` · Scope: M
- **Manual (Hillary, `expo start --web`, dev Clerk instance):**
  1. [ ] Google account that **already has** an email/password account → signs in; note Django `User.id` before/after (same user, no second row). If it creates a duplicate: STOP and ask.
  2. [ ] A Google account **never seen** by Clerk → note the logged `status` and `missingFields`. Expect `missing_requirements` and `username` in `missingFields`. If not: STOP, revise plan.
  3. [ ] Cancel the Google window → stays on sign-in, no error.
  4. [ ] Remove the temporary logging once confirmed.

### Checkpoint A
- [ ] Gates green, no new tsc/lint errors vs baseline
- [ ] Manual 1-3 above pass (same Django user; new-user status confirmed; cancel clean)
- [ ] Google `image_url` shows up as `Profile.imageUrl` for the returning user (spec assumption 5)
- [ ] **Human review before Phase 2**

---

## Phase 2 — New users

### T2: Extract `useUsernameAvailability` (refactor only)
- [ ] Move the debounce + stale-response guard + suggestions + fail-open logic out of `sign-up.tsx` into `src/hooks/useUsernameAvailability.ts` returning `{ checking, available, suggestions }`
- [ ] `sign-up.tsx` uses the hook; markup and behaviour identical
- Acceptance: `app/(auth)/__tests__/sign-up.test.tsx` passes **with zero edits**; no behaviour change
- Verify: `npx jest "app/(auth)"`, full gates vs baseline. If the existing test needs changes: STOP and ask.
- Files: `src/hooks/useUsernameAvailability.ts`, `app/(auth)/sign-up.tsx` · Scope: S

### T3: `choose-username` screen + new-user branch
- [ ] Tests first: submit disabled while checking or known-taken; available → `signUp.update({ username })` then `setActive({ session: createdSessionId })` then `router.replace('/')`; Clerk error (e.g. taken at submit) shown inline via `getClerkErrorMessage`; **Cancel** goes to `/sign-in` without calling `setActive` or `update`; taken name shows suggestions that fill the field; no `missing_requirements` sign-up in progress → redirect to `/sign-in`
- [ ] `app/(auth)/choose-username.tsx` using `useUsernameAvailability`; styles matching sign-up
- [ ] `GoogleButton`: replace the T1 stub with `router.replace('/choose-username')` when `authSessionResult.type === 'success'` **and** `!createdSessionId` **and** `signUp.status === 'missing_requirements'`
- Acceptance: new Google user cannot reach the app without a username; quitting leaves no session and no Django user
- Verify: `npx jest "app/(auth)" src/components`, full gates; **manual (web):** brand-new Google account → pick taken name (see suggestions) → pick free name → lands on `/`; check Django `Profile.display_username` equals it and the user appears in People search; repeat and Cancel → no `User` row for that sub
- Files: `app/(auth)/choose-username.tsx`, `src/components/GoogleButton.tsx`, tests for both · Scope: M

### T4: Button on `sign-up`
- [ ] Render `GoogleButton` above the form with the same "or" divider; test that it renders on sign-up and the email form still works (`signup-submit` etc.)
- Acceptance: existing `sign-up.test.tsx` still passes untouched; button placement matches sign-in
- Verify: `npx jest "app/(auth)"`, full gates
- Files: `app/(auth)/sign-up.tsx`, `app/(auth)/__tests__/` (new test file) · Scope: S

### Checkpoint B
- [ ] Gates green; test count up; no new tsc/lint errors
- [ ] Spec success criteria 1-5 verified on web
- [ ] Email/password sign-up and sign-in still work end to end
- [ ] **Human review before Phase 3**

---

## Phase 3 — Native and launch

### T5: Native verification (iOS + Android dev builds)
- [ ] `npx expo run:ios` and `run:android`; walk the new-user, returning-user, cancel and quit-on-username flows
- [ ] Fix anything native-specific (redirect URL / scheme `frontend`, `expo-web-browser` options) in `app.json` or the button; add `frontend://sso-callback` to Clerk's allowed redirect URLs if the dashboard requires it
- Acceptance: all four flows pass on both platforms
- Verify: manual on simulators/devices + full gates + `expo export --platform web` still builds
- Files: `app.json` (only if needed), `src/components/GoogleButton.tsx` · Scope: S

### T6: Production setup + beta checklist (Hillary)
- [ ] Follow "Google Cloud / Clerk setup" in the spec: Google Cloud Web OAuth client (consent screen External + Testing), add test users, paste Client ID/Secret into the Clerk **production** Google connection, add redirect URLs
- [ ] Add a "Google sign-in" section to `DEPLOY.md` (or `SPEC.md` if `DEPLOY.md` doesn't exist yet) listing those steps and the "add each tester to Google Test users" invite step
- [ ] Smoke test on the deployed Render frontend with one test-user account
- Acceptance: a listed test user can sign up and log in on the production site; an unlisted account gets Google's "access blocked" page (expected)
- Files: `DEPLOY.md` or `SPEC.md` · Scope: S (mostly manual)

### Checkpoint C — done
- [ ] Spec success criteria 1-6 all met on web, iOS, Android
- [ ] Temporary logging removed; no Google/Clerk secrets in the repo
- [ ] Ready for review / PR
