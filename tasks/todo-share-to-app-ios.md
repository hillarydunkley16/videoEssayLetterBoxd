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

### T3: Xcode Personal Team signing + first Simulator build — BLOCKED
- [x] Apple ID / Personal Team setup was already done on this machine (two Personal
      Teams found registered in Xcode) — no interactive signing step needed for a
      Simulator build (signing isn't required for Simulator at all; only T5's physical
      device needs it)
- [ ] `npx expo run:ios` builds and launches successfully in the Simulator — **still
      failing**, unrelated to signing or to this module's own config
- **Blocker found**: Xcode 26.3 (Swift 6.2) is incompatible with Expo SDK 57's
  `expo-modules-jsi@57.1.0`, independent of anything in this spec:
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
- Acceptance: not met — build does not succeed
- Verify: `npx expo run:ios` still exits 1
- Files: `frontend/patches/expo-modules-jsi+57.1.0.patch`, `frontend/package.json`
  (postinstall script), `frontend/package-lock.json` (RuntimeScheduler fix only,
  language-mode-5 attempt reverted) · Scope: S (became larger once the blocker
  surfaced)
- **Next step needs a decision**: wait for Expo to ship an SDK 57 patch for Xcode
  26.x, or update to Xcode 26.5+ (per the RuntimeScheduler issue thread, unclear if it
  also resolves the second wave), or downgrade Xcode. Not something to keep patching
  around blind.

### T4: Simulator verification (Safari/Notes share)
- [ ] Share a YouTube URL from Safari (or paste one into Notes and share from there) to
      Visual Arguments in the Simulator, **signed in**: app foregrounds and lands on
      `quickLog` with the correct title/thumbnail populated
- [ ] Same share, **signed out**: share is held, user routed to sign-in, and after
      signing in lands on `quickLog` for that same video without re-sharing
- [ ] Watch for a visible flash/flicker from the extension's transparent hand-off view
      (`iosHideView` default) — note it if present, don't silently accept a bad UX
- [ ] Share a non-YouTube URL: no crash, no navigation, share intent reset cleanly
- Acceptance: all four cases behave identically to Android's T5/T6 acceptance notes,
  with zero platform-specific code differences
- Verify: manual, on Simulator
- Files: none (verification only), unless T4 surfaces a real gap in
  `useShareIntentRouter` — see plan's risk note · Scope: M

### Checkpoint A — core mechanism confirmed on Simulator
- [ ] All four T4 cases pass
- [ ] `npx expo export --platform web` still succeeds (extension doesn't regress web)

### T5: physical-device signing + build
- [ ] Connect a physical iPhone via cable, trust the machine
- [ ] Confirm both targets sign successfully to the device under the same free
      Personal Team (Xcode may need the device added under Settings → Accounts →
      manage devices)
- [ ] `npx expo run:ios --device` builds and installs to the physical device
- Acceptance: app installs and launches on the physical device with no signing errors
- Verify: `npx expo run:ios --device` exits 0, app opens on device
- Files: none · Scope: S

### T6: physical-device verification (real YouTube app)
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

### Checkpoint B — end-to-end confirmed on physical device
- [ ] Both T6 cases pass with a confirmed backend row
- [ ] No iOS-specific branch was introduced anywhere in `useShareIntentRouter` or the
      API layer to make this work

### T7: full verification pass
- [ ] All Success Criteria in `tasks/spec-share-to-app-ios.md` checked off
- [ ] `python manage.py test`, `npx jest`, `npx tsc --noEmit`, `npm run lint`,
      `npx expo export --platform web` all green
- [ ] Manual re-check: Android share-to-app flow (already shipped) still works —
      confirms enabling the iOS extension didn't regress the Android config
- Verify: run every command above; report results
- Files: none (verification only) · Scope: XS

## Deferred — explicitly out of scope here

- [ ] **EAS Build / TestFlight distribution** for the iOS extension. Local
      `run:ios` is sufficient for this spec; revisit only if/when distributing to
      testers beyond your own device becomes a goal.
- [ ] **Apple Developer Program enrollment.** Not needed for local build/test per
      spec decision 1; only relevant if the deferred item above is picked up.
