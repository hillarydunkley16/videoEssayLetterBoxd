# Todo: Share-to-App — iOS (Share Extension)

Plan: `tasks/plan-share-to-app-ios.md`. Spec: `tasks/spec-share-to-app-ios.md`.
Branch `v2`. All application logic (`useShareIntentRouter`, `extractYoutubeId`,
`getOrCreateVideoEssayByYoutubeId`, the backend endpoint) is already built and shipped
in `tasks/todo-share-to-app.md` — this list only covers iOS OS-registration and
verification.

## Tasks

### T1: enable the iOS Share Extension in app.json — done
- [x] Remove `disableIOS: true` from the `expo-share-intent` plugin entry in
      `frontend/app.json`
- [x] Add `"iosAppGroupIdentifier": "group.com.hillarydunkley.frontend.shareintent"`
- [x] Leave `iosActivationRules` unset (plugin default: URL + web-page, matching
      Android's `text/*` scope)
- Acceptance: `app.json` diff is exactly these two changes, nothing else — confirmed
- Verify: `git diff frontend/app.json` (one line changed, as expected); JSON validated
  (`python3 -c "import json; json.load(open('app.json'))"`); full jest suite unaffected
  (187/187)
- Files: `frontend/app.json` · Scope: XS

### T2: prebuild and inspect the generated iOS project — done
- [x] `npx expo prebuild --platform ios --clean` — exit 0, CocoaPods installed clean
- [x] Confirmed the `ShareExtension` target's `Info.plist`
      (`ios/ShareExtension/ShareExtension-Info.plist`) has the expected `NSExtension`
      entry with `NSExtensionActivationSupportsWebURLWithMaxCount: 1` and
      `NSExtensionActivationSupportsWebPageWithMaxCount: 1`, plus
      `AppGroupIdentifier: group.com.hillarydunkley.frontend.shareintent`
- [x] Confirmed the App Group entitlement is present and identical on both
      `ios/frontend/frontend.entitlements` and
      `ios/ShareExtension/ShareExtension.entitlements`
      (`com.apple.security.application-groups: [group.com.hillarydunkley.frontend.shareintent]`)
- [x] No conflicts from the other registered plugins — prebuild log shows only the
      expected `[expo-share-intent]` lines, no errors from expo-router,
      expo-splash-screen, expo-secure-store, or datetimepicker; CocoaPods install
      succeeded (exit 0)
- [x] One informational note from the prebuild log, expected at this stage and not a
      problem: `No DEVELOPMENT_TEAM found in main app build settings. Developer will
      need to manually add Dev Team.` — this is exactly what T3 (Xcode Personal Team
      signing) does next
- Acceptance: both generated files inspected directly and match the above; prebuild
  exits clean (no "Config sync failed" error) — confirmed
- Verify: read the generated `Info.plist` and `.entitlements` files under `ios/`; full
  jest suite unaffected (187/187, unrelated to native project regen)
- Files: none tracked (native project is gitignored/disposable) · Scope: S

### T3: local Simulator build — BLOCKED, pivoting to EAS (see revised T3 below)
- [x] Apple ID / Personal Team setup was already done on this machine (two Personal
      Teams found registered in Xcode) — no interactive signing step needed for a
      Simulator build (signing isn't required for Simulator at all; only T5's physical
      device needs it)
- [ ] `npx expo run:ios` builds and launches successfully in the Simulator — **still
      failing**, unrelated to signing or to this module's own config
- **Blocker found**: Xcode 26.3 is below Expo SDK 57's documented minimum (26.4+,
  which itself requires a macOS Sequoia → Tahoe 26.2 upgrade — confirmed via Expo's
  own SDK reference and Apple's Xcode release notes). Independent of anything in this
  spec's own scope:
  1. `RuntimeScheduler.h` used `SWIFT_RETURNS_RETAINED` on two constructors in a way
     the newer compiler rejects — this one is fixed and committed
     (`3affd9c`, patch-package, matches upstream expo/expo#49740).
  2. After that fix, a second, different set of Swift 6.2 "strict concurrency /
     sending risks data races" errors surfaced in the same package
     (`JavaScriptRuntime.swift`) — this is expo/expo#50470, an **open, unresolved**
     upstream issue as of this attempt.
  3. Tried forcing the package to Swift language mode 5 (the only real lever, since
     this package builds via its own SwiftPM `Package.swift`, not a Podfile-governed
     Xcode target — a Podfile `post_install` hook has no effect on it). This did not
     converge: it fixed the reported errors but immediately surfaced two *new*,
     different failures (a regex-literal parse error, an actor-isolation error) that
     don't exist in language mode 6 — reverted.
- Acceptance: not met — local build does not succeed
- Verify: `npx expo run:ios` still exits 1
- Files: `frontend/patches/expo-modules-jsi+57.1.0.patch`, `frontend/package.json`
  (postinstall script), `frontend/package-lock.json` (RuntimeScheduler fix only,
  language-mode-5 attempt reverted) · Scope: S (became larger once the blocker
  surfaced)
- **Resolution**: per spec Decision 6, pivot the Simulator step to EAS Build instead
  of continuing to patch an open upstream issue blind. Local build stays broken until
  spec Open Question 3 resolves (Expo patch, macOS/Xcode upgrade, or — for device
  builds specifically — Apple Developer Program enrollment). See the revised T3 task
  below, which replaces this one going forward.

### T3 (revised): EAS project setup + cloud Simulator build — done
- [x] `npx eas-cli whoami` confirmed already logged in (`hillarydunkley` /
      `hvgdunkley@gmail.com`) — no interactive login needed
- [x] `npx eas-cli build:configure -p ios` couldn't run non-interactively (its "create
      an EAS project?" prompt needs a real TTY); used `npx eas-cli project:init
      --account hillarydunkley --non-interactive` instead — created
      `@hillarydunkley/frontend` (project ID `9f28faf6-dd98-4e34-9662-4e8c30bf7e84`),
      linked it into `app.json`
- [x] Confirmed the exact predicted conflict: `project:init` auto-injected
      `extra.eas.build.experimental.ios.appExtensions` for `ShareExtension` (matching
      achorein/expo-share-intent-demo#1) — removed it, keeping only
      `extra.eas.projectId`
- [x] Wrote `frontend/eas.json` by hand (`build:configure`'s other job) since the
      interactive command never got that far
- [x] `development` profile needs `developmentClient: true`, which EAS refused to
      build without `expo-dev-client` installed (a new dependency we don't need just
      for manual native verification) — used the `preview` profile instead
      (`ios.simulator: true`, no dev-client requirement) rather than add that
      dependency
- [x] `npx eas-cli build --profile preview --platform ios --non-interactive` — cloud
      build succeeded on the first attempt (build
      `70102b80-62e4-4567-82ca-bf0a7907be1a`), confirming the incompatibility is local
      to this machine's Xcode, not the project/config
- [x] `npx eas-cli build:run -p ios --latest --profile preview` downloaded, installed,
      and launched the app on the booted Simulator; `xcrun simctl listapps booted`
      confirms `com.hillarydunkley.frontend` installed with its
      `group.com.hillarydunkley.frontend.shareintent` App Group container already
      provisioned
- Acceptance: cloud build succeeds; artifact installs and launches in the iOS
  Simulator with no signing errors — confirmed
- Verify: EAS build dashboard shows the successful build; app installed + launched on
  Simulator per `simctl`; `git diff frontend/app.json` shows only the expected
  `extra.eas.projectId`/`owner` addition; full jest suite unaffected (187/187)
- Files: `frontend/eas.json` (new), `frontend/app.json` (`extra.eas.projectId` +
  `owner` added) · Scope: S

### T4: Simulator verification (Safari/Notes share, via EAS-built artifact)
- [x] **Tooling limitation found**: no way to script Simulator taps from here —
      `xcrun simctl` has no tap-injection command (unlike `adb input tap` for
      Android), and `osascript`/System Events has no Accessibility permission granted
      to this process to click the Simulator window via AppleScript. Manual taps in
      the Simulator are done by you; I open pages, take screenshots, and check
      logs/DB after each step.
- [x] **First crash found and fixed**: opened `youtu.be/dQw4w9WgXcQ` in Safari, tapped
      YouTube's in-page share icon, selected "frontend - Share Extension" → app
      foregrounded then immediately crashed ("frontend quit unexpectedly"). Crash log
      (`~/Library/Logs/DiagnosticReports/frontend-*.ips`) showed the real cause was
      unrelated to sharing: `RCTFatalException: Missing
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — the EAS cloud build has no access to the
      local `.env` file, so `ClerkProvider` failed on every launch, not just via
      share. Fixed with `npx eas-cli env:push preview --path .env --force` (uploads
      to EAS's own environment-variable store, not a repo file — nothing to commit
      here), then rebuilt (`4df7ab1b-7bd0-47f5-9e6b-27c6c03ebea4`) and reinstalled.
      Confirmed fixed: app now launches straight to the signed-out home screen with
      real backend data loading.
- [x] **Local dev-client loop added mid-verification** (user request): installed
      `expo-dev-client`, built via the `development` EAS profile
      (`c279e8eb-babf-4522-aa9d-ab4df2293ab0`), pushed env vars to the `development`
      EAS environment too, killed a stale leftover `expo run:android` process that
      was holding port 8081 from the Android testing days, and connected
      `npx expo start --dev-client` to the installed build. Gives live
      `console.log`/Fast Refresh for the rest of this task instead of a full ~5min
      EAS rebuild per JS change.
- [x] **Second bug found and fixed**: first real share attempt reached the app (no
      crash) but landed on expo-router's "Unmatched Route" screen instead of
      `quickLog`. Root cause: `app/+native-intent.ts` predates this feature (an
      abandoned earlier prototype using an unrelated, unused library `expo-sharing`)
      and its `redirectSystemPath` never matched `expo-share-intent`'s actual launch
      URL shape (`<scheme>://dataUrl=...`), plus its catch-all `try/catch` silently
      redirected *any* normal relative route to `/` on `new URL()` throwing. Fixed
      with a real redirect for the `dataUrl=` pattern, RED/GREEN tests added
      (`app/__tests__/native-intent.test.ts`), unused `expo-sharing` dependency
      removed. Commit `4729113`.
- [x] Share a YouTube URL from Safari to Visual Arguments in the Simulator,
      **signed in**: confirmed working end-to-end after the fix above, verified via
      temporary debug logging (added, observed, then fully reverted — no net diff)
      showing the complete chain: `hasShareIntent` → `extractYoutubeId` →
      `getOrCreateVideoEssayByYoutubeId` (created "Robin Williams at His ABSOLUTE
      Funniest For 10 Minutes Straight!") → `router.push` to `quickLog` → user rated
      it → log created successfully (backend `201`) → share intent reset cleanly,
      no re-fire. Note: discovered mid-session that Clerk's session persists across
      EAS rebuilds via iOS Keychain (survives reinstall under the same signing
      identity), so this Simulator was already signed in as the real dev account
      throughout — not the earlier Android-era `+clerk_test@` bypass account.
- [x] **Same share, signed out**: reset the persisted session with
      `xcrun simctl keychain booted reset` (Clerk's tokenCache survives app
      reinstall via iOS Keychain, so signing out needed a keychain reset, not just a
      reinstall) — confirmed signed-out state (`User is undefined: true`), then
      shared `youtu.be/y6120QOlsfU` (Darude - Sandstorm): app foregrounded to the
      normal signed-out home screen, share held silently, no crash, no navigation —
      matching Android's T6 behavior exactly. Then signed in via the UI: resumed to
      `quickLog` for the same video automatically. Confirmed via a genuinely new
      backend `Log` row (id 17, `youtube_id=y6120QOlsfU`, rating 5, created just
      then) — verified this wasn't a stale/reused screen by checking the DB directly,
      since a mid-test code edit (adding debug logging) triggered a Fast Refresh
      that made an *earlier* still-open sheet ambiguous at first glance.
- [x] Watch for a visible flash/flicker from the extension's transparent hand-off view
      (`iosHideView` default) — confirmed clean by you across all shares done this
      session (Rick Astley, Robin Williams, Darude x2, example.com): felt seamless,
      no flash noticed. Accepting the plugin's default as-is per spec Decision 4.
- [x] Share a non-YouTube URL (`https://example.com`): app foregrounded to the
      normal signed-in home feed, no crash, no navigation attempt, no errors in
      Metro logs — share intent reset silently as designed
- Acceptance: all four T4 cases confirmed — signed-in, signed-out-then-resume,
  no-flash, non-YouTube-URL-safe
- Verify: manual, on Simulator (via the dev-client + local Metro loop above); full
  jest suite 189/189 after debug-logging cleanup (one unrelated flaky failure on
  first run, clean on retry)
- Files: `frontend/app/+native-intent.ts`, `frontend/app/__tests__/native-intent.test.ts`,
  `frontend/package.json` (`expo-dev-client` added, `expo-sharing` removed) · Scope: M

### Checkpoint A — core mechanism confirmed on Simulator — closed
- [x] All four T4 cases pass
- [x] `npx expo export --platform web` still succeeds (extension doesn't regress web)

### T5: physical-device signing + build — PARKED
- [ ] Connect a physical iPhone via cable, trust the machine
- [ ] Confirm both targets sign successfully to the device under the same free
      Personal Team (Xcode may need the device added under Settings → Accounts →
      manage devices)
- [ ] `npx expo run:ios --device` builds and installs to the physical device
- Acceptance: app installs and launches on the physical device with no signing errors
- Verify: `npx expo run:ios --device` exits 0, app opens on device
- Files: none · Scope: S
- **Parked** — blocked on the same local-toolchain issue as the original T3 (local
  `run:ios` fails regardless of target). Per spec Open Question 3, resume only once
  you decide on: waiting for an Expo patch, a macOS/Xcode upgrade, or Apple Developer
  Program enrollment (which would let this go through EAS instead of local `run:ios
  --device`). Not attempted until then.

### T6: physical-device verification (real YouTube app) — PARKED
- [ ] From the real YouTube iOS app, share a video to Visual Arguments, **signed in**:
      lands on `quickLog` for that exact video, correct title/thumbnail
- [ ] Same share, **signed out**: held, routed to sign-in, resumes to `quickLog` for
      the same video after sign-in completes
- [ ] Confirm a real `VideoEssay` row was created (or reused) via the Django admin/shell,
      same style of verification as Android's T5/T6
- Acceptance: matches Android's live-verification bar exactly — real app, real device,
  both auth states
- Verify: manual, on a physical device with the real YouTube app installed
- Files: none · Scope: S
- **Parked** along with T5 — depends on it.

### Checkpoint B — end-to-end confirmed on physical device — PARKED
- [ ] Both T6 cases pass with a confirmed backend row
- [ ] No iOS-specific branch was introduced anywhere in `useShareIntentRouter` or the
      API layer to make this work

### T7: full verification pass (Simulator-scoped until T5/T6 unblock)
- [ ] Simulator-scoped Success Criteria in `tasks/spec-share-to-app-ios.md` checked
      off (physical-device criteria remain open, tracked separately, not blocking this
      pass)
- [ ] `python manage.py test`, `npx jest`, `npx tsc --noEmit`, `npm run lint`,
      `npx expo export --platform web` all green
- [ ] Manual re-check: Android share-to-app flow (already shipped) still works —
      confirms enabling the iOS extension didn't regress the Android config
- Verify: run every command above; report results
- Files: none (verification only) · Scope: XS
- Note: revisit this task once T5/T6 unblock, to check off the remaining
  physical-device Success Criteria and close the spec out fully.

## Deferred — explicitly out of scope here

- [x] ~~**EAS Build / TestFlight distribution** for the iOS extension.~~ **No longer
      deferred for the Simulator step** — adopted for T3/T4 per spec Decision 6, once
      local `run:ios` proved incompatible with this machine's Xcode/SDK combo.
      TestFlight/broader distribution remains genuinely out of scope.
- [ ] **Apple Developer Program enrollment.** Still not committed to — this is exactly
      the decision parked at spec Open Question 3 / T5-T6. Only relevant if you choose
      the EAS-for-device path over waiting for a local fix.
