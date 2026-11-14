# Spec: Sign up and log in with Google

Follows `SPEC-username-onboarding.md` (live username availability on the sign-up page) and
reuses its `checkUsernameAvailability` endpoint and suggestions. Single capability, so no
capability map is needed.

## Objective

Today the only way in is email + password + emailed code (`frontend/app/(auth)/sign-up.tsx`,
`sign-in.tsx`). Add **"Continue with Google"** to both screens so a user can create an account
or return to one in one tap, on web, iOS and Android.

**Users:** closed-beta users who'd rather not manage another password.

**Success looks like:** a new user taps Continue with Google, picks a username, and lands in the
app with a `Profile` that has a `display_username`; a returning Google user lands straight in
the app; nobody ends up with a duplicate account or an app profile with no username.

## Decisions (from clarifying questions, 2026-11-14)

1. **Username: prompt after Google.** Google gives us name, email and photo but no username, and
   `display_username` is what People search and the rest of the app key on. A new Google user is
   sent to a "Pick your username" screen reusing the live availability check and suggestions from
   `SPEC-username-onboarding.md`. They can't reach the app until it's set.
2. **Platforms: web + iOS + Android.** Native needs a dev build (`expo-dev-client` is installed;
   Expo Go cannot do the OAuth redirect).
3. **Existing email: link automatically.** Clerk links the Google identity to the existing user
   with the same verified email, so the same Django `User`/`Profile` is used. No new backend
   account logic.
4. **Email/password stays.** Google is additive; no existing flow is removed or changed.

## Assumptions (correct me if wrong)

1. **Verified 2026-11-14 against installed `@clerk/clerk-expo` 2.19.22 (`dist/hooks/useSSO.js`).**
   Sign-in and sign-up are one call: `useSSO().startSSOFlow({ strategy: 'oauth_google' })` does
   `signIn.create`, opens the browser, and if the result is `transferable` runs
   `signUp.create({ transfer: true })`. `oauth_google` is a valid `OAuthStrategy`, and
   `SignUpStatus` includes `missing_requirements`. Consequences:
   - It returns `{ createdSessionId, authSessionResult, setActive, signIn, signUp }` and returns
     `signUp` even when the user cancelled, so "new user" must be detected as
     `authSessionResult?.type === 'success'` **and** `!createdSessionId` **and**
     `signUp?.status === 'missing_requirements'`, not on `signUp` alone.
   - Default redirect is `makeRedirectUri({ path: 'sso-callback' })`; don't override it.
   - **Web uses a popup** (`expo-web-browser` `window.open`). It throws `ERR_WEB_BROWSER_BLOCKED`
     if called too long after the tap, so call `startSSOFlow` straight from the press handler.
     The popup lands on `/sso-callback`, which has no route in this app today and nothing calls
     `WebBrowser.maybeCompleteAuthSession()`; both are needed on web (new task).
   - Still unverified (runtime/dashboard, not in the package): that Clerk actually returns
     `missing_requirements` with `username` for a Google user, and that `useSignUp()` on
     `choose-username` sees the same in-progress `signUp`. Prove both on the dev instance first.
2. **Backend needs no change for auth.** `ClerkAuthentication` already creates/updates the
   `User`/`Profile` from the JWT `sub` claim; the `username` claim arrives once the user sets one.
3. Clerk's username is currently required at sign-up. A Google sign-up completes with
   `signUp.status === 'missing_requirements'` and `missingFields` containing `username`; we fill it
   with `signUp.update({ username })` then `setActive`. (Confirm in the Clerk dashboard that this
   path works with username required. Production needs Google enabled with our own OAuth
   credentials, see "Google Cloud / Clerk setup".)
4. Expo redirect URL uses the existing app scheme `frontend`; Clerk's allowlist must include it.
5. Profile photo comes from Google via Clerk's `image_url` claim, which is already stored as
   `Profile.imageUrl` (external URL, no uploads).

## Tech stack

Existing: Expo ~57 / expo-router, `@clerk/clerk-expo ^2.19.20`, `expo-auth-session`,
`expo-web-browser`, `expo-linking`, Django/DRF with `ClerkAuthentication`. **No new dependencies
expected**; adding one requires asking first.

## Commands

```
# Frontend (from frontend/)
npx tsc --noEmit
npm run lint
npm test
npx jest "app/(auth)"
npx expo export --platform web
npx expo run:ios          # native Google flow needs a dev build
npx expo run:android

# Backend (from backend/), only if the username work touches it
python manage.py test movie_csv.test_authentication
```

## Project structure

```
frontend/app/(auth)/sign-in.tsx          → add Continue with Google
frontend/app/(auth)/sign-up.tsx          → add Continue with Google
frontend/app/sso-callback.tsx            → NEW (web): landing route for the OAuth popup; calls
                                           WebBrowser.maybeCompleteAuthSession()
frontend/app/(auth)/choose-username.tsx  → NEW route: pick username after Google sign-up
frontend/src/components/GoogleButton.tsx → NEW shared button + startSSOFlow logic (one place)
frontend/app/(auth)/__tests__/           → tests alongside existing sign-up.test.tsx
frontend/app.json                        → only if the redirect scheme/plugins need changing
```

Route component names stay PascalCase, per CLAUDE.md. The shared button owns the SSO call and
error handling so sign-in and sign-up can't drift.

## Flows

**New user:** Continue with Google → Google consent → return to app → `choose-username` →
`signUp.update({ username })` → `setActive` → `/`.

**Returning user:** Continue with Google → Google consent → `setActive` → `/`.

**Existing password user, same email:** same as returning; the accounts are linked.

**Cancelled / failed:** user closes the Google window or denies consent → stay on the screen, no
error banner for a plain cancel, a readable message (via `getClerkErrorMessage`) for real errors.

## Code style

Match the existing auth screens: function component, hooks from `@clerk/clerk-expo`, errors
through `getClerkErrorMessage`, `StyleSheet.create` at the bottom, `ThemedText`/`ThemedView`.

```tsx
const { startSSOFlow } = useSSO()

const onGooglePress = async () => {
  try {
    const { createdSessionId, setActive, signUp, authSessionResult } = await startSSOFlow({
      strategy: 'oauth_google',
    })
    if (createdSessionId) {
      await setActive!({ session: createdSessionId })
      router.replace('/')
    } else if (
      authSessionResult?.type === 'success' &&
      signUp?.status === 'missing_requirements'
    ) {
      router.replace('/choose-username')
    }
    // Anything else is a cancel/dismiss: stay put, no error.
  } catch (err) {
    setErrors(getClerkErrorMessage(err))
  }
}
```

Native only: call `WebBrowser.warmUpAsync()` on mount and `WebBrowser.maybeCompleteAuthSession()`
at module scope (web needs the latter to close the popup).

## Testing strategy

Frontend gates stay `tsc --noEmit`, `expo lint`, `expo export --platform web`, plus jest tests
(`jest-expo`) next to the existing `sign-up.test.tsx`, with `@clerk/clerk-expo` mocked:

- Google button on both screens calls `startSSOFlow` with `oauth_google`.
- Returning user (`createdSessionId` present) → `setActive` then navigate to `/`.
- New user (`missing_requirements`) → navigates to `choose-username`, not `/`.
- `choose-username`: submit disabled while checking or when known-taken; success calls
  `signUp.update({ username })` then `setActive`; Clerk error is shown inline.
- User cancel → no error shown; real error → message shown.
- `choose-username` Cancel → returns to `sign-in` without calling `setActive` or `signUp.update`.
- Google button renders above the email form, with an "or" divider, on both screens.
- Double-tap on the button fires one SSO flow (same bug class as the log double-tap regression).

Manual verification (cannot be unit tested, must be done before beta): full flow on web, an iOS
dev build, and an Android dev build, covering new user, returning user, and an existing
email/password account signing in with Google.

## Boundaries

- **Always:** keep the Clerk issuer/keys env-driven; resolve the backend URL only via
  `src/api/client.ts`; route every Clerk error through `getClerkErrorMessage`; run tsc, lint and
  tests before committing.
- **Ask first:** adding a dependency; changing `ClerkAuthentication` or any backend model or
  migration; changing the app scheme or bundle/package ids; touching production Clerk settings
  (I can list what to change, you flip the switches).
- **Never:** commit Google client IDs/secrets or Clerk keys; remove or alter the email/password
  flow; let a Google user into the app with no username; edit an applied migration.

## Success criteria

1. A new Google user on web, iOS and Android ends up signed in with a `Profile` whose
   `display_username` is set and unique, and appears in People search.
2. A returning Google user goes from tap to home with no extra screens.
3. Signing in with Google using an email that already has a password account yields the **same**
   `User.id`/`Profile` (no duplicate row).
4. Cancelling Google leaves the user on the same screen with no error banner.
5. Email/password sign-up and sign-in behave exactly as before (existing tests pass untouched).
6. `tsc --noEmit`, `expo lint`, `npm test` and `expo export --platform web` pass.

## Resolved questions (2026-11-14)

1. **Quit on `choose-username`: discard the attempt.** No resume. The half-finished Clerk sign-up
   is abandoned (never `setActive`); next Google tap starts a fresh flow. Add a "Cancel" action on
   that screen that goes back to `sign-in`. No Django `User`/`Profile` exists yet at that point
   (it is created only on the first authenticated API call), so there's nothing to clean up
   server-side.
2. **Google Cloud OAuth client: owner is Hillary; setup steps below.**
3. **Google OAuth app stays in Testing mode for the beta.** Only users added as **Test users**
   in the Google consent screen can sign in (cap 100); anyone else gets Google's "access
   blocked" page, which is not an app bug. Moving to "In production" later needs Google's app
   verification (name, logo, privacy policy, scopes).
4. **Button placement: above the email form**, with an "or" divider between them, on both
   `sign-in` and `sign-up`.

## Google Cloud / Clerk setup (owner: Hillary)

Source: Clerk's Google connection guide
(`clerk.com/docs/guides/configure/auth-strategies/social-connections/google`).

**One OAuth client is enough.** `useSSO` runs Google sign-in in a browser (popup on web,
in-app browser sheet on native) that redirects back through Clerk, so we need a single
**Web application** client. We do **not** need separate iOS/Android OAuth client IDs; those are
only for the native Google Sign-In SDK, which this design doesn't use. (Google also forbids
embedded WebViews for OAuth; `expo-web-browser` uses the system browser, so that's fine.)

1. **Dev instance (do this first, no Google Cloud needed):** Clerk Dashboard → SSO connections →
   Add connection → For all users → Google. Clerk's shared credentials work out of the box, so
   the whole feature can be built and tested before any Google Cloud setup.
2. **Production instance:** same path, then turn on **Enable for sign-up and sign-in** and
   **Use custom credentials**. Copy the **Authorized Redirect URI** Clerk shows.
3. **Google Cloud Console:** create/select a project → Google Auth Platform (APIs & Services) →
   consent screen: User type **External**, publishing status **Testing** → add yourself and each
   beta tester under **Test users** → Credentials → Create credentials → **OAuth client ID** →
   type **Web application** → Authorized redirect URI = the one from step 2 (Authorized
   JavaScript origins: the deployed frontend origin) → Create, then copy Client ID and Secret.
4. Paste Client ID and Secret into the Clerk production Google connection → Save.
5. In Clerk, add the native redirect (`frontend://sso-callback`) and the web origin's
   `/sso-callback` to the allowed redirect URLs for the instance.
6. Never commit the Client ID/Secret; they live only in the Clerk dashboard.

**Beta gotcha:** a new tester must be added to Google's Test users list *and* sign in with that
exact Google account. Put "add to Google test users" in the beta-invite checklist.

## Next phases (after you approve)

Plan → `tasks/plan-google-signin.md`, Tasks → `tasks/todo-google-signin.md`, following the
per-feature naming used for the other specs. Suggested slices: (1) shared button + returning-user
sign-in on web, (2) `choose-username` + new-user path, (3) native dev-build verification,
(4) production Clerk/Google config checklist.
