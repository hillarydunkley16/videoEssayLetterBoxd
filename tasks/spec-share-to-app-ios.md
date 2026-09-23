# Spec: Share-to-App — iOS (Share Extension)

Branch: `v2`. Follow-on module to `tasks/spec-share-to-app.md` (Android, shipped).
Single capability (register an iOS Share Extension + reuse the existing resolve/log
flow) — no capability map needed.

## Objective

Bring the already-shipped Android share-to-app flow to iOS: a user watching a video
essay in the YouTube iOS app taps Share, selects Visual Arguments from the system
share sheet, and lands in the existing `quickLog` flow for that video — same outcome
as Android, different OS mechanism to get there.

**Everything behind the OS boundary is already built and reusable as-is:**
`fetch_oembed_metadata` (backend), `VideoEssayFromYoutubeId` endpoint,
`getOrCreateVideoEssayByYoutubeId` (frontend API client), `extractYoutubeId` (URL
parser), and `useShareIntentRouter` (the effect that resolves a share and navigates,
including the signed-out → sign-in → resume path and the T7 error-alert fix). None of
these are Android-specific — `expo-share-intent`'s `useShareIntentContext()` returns
the same shape on both platforms. **This spec is scoped entirely to the OS-registration
piece**: enabling `expo-share-intent`'s iOS Share Extension target and verifying the
existing hook receives what it expects.

**Success looks like:** sharing a YouTube video URL from the YouTube iOS app to Visual
Arguments lands the user in `quickLog` with the correct title/thumbnail populated,
ready to rate, within one app launch — including when the user isn't signed in yet —
matching Android's behavior exactly.

## Decisions (confirmed)

1. **Provisioning**: free Apple ID + Xcode Personal Team is sufficient for local
   build/test — no paid Apple Developer Program membership required for this spec.
   Known cost of the free tier: the provisioning profile expires every 7 days, so a
   physical-device install needs periodic re-running of `npx expo run:ios` during
   development; capped at ~3 registered devices; no TestFlight/Ad Hoc distribution to
   anyone else. None of these block building and testing on your own device.

   **Superseded for the Simulator build step (T3/T4) — see Decision 6.** Local
   `npx expo run:ios` on this machine hit an unrelated toolchain wall (Xcode 26.3 is
   below Expo SDK 57's documented minimum of Xcode 26.4+, which itself requires a
   macOS Sequoia → Tahoe upgrade). Decision 1 as originally written still governs
   physical-device signing (T5/T6) once that path is unblocked.
2. **Content types accepted**: URLs only, via `expo-share-intent`'s **default**
   `iosActivationRules` (`NSExtensionActivationSupportsWebURLWithMaxCount: 1` +
   `NSExtensionActivationSupportsWebPageWithMaxCount: 1`) — no customization needed,
   this already matches what a YouTube share sends and mirrors Android's `["text/*"]`
   scope (link-only, not images/video files).
3. **App Group identifier**: `group.com.hillarydunkley.frontend.shareintent`, set via
   `iosAppGroupIdentifier` in the plugin config — explicit rather than relying on the
   plugin's auto-derived default, so it's visible in `app.json` and stable across
   `prebuild --clean` runs.
4. **Extension UI**: use the plugin's built-in transparent hand-off view
   (`iosHideView: true`, the default) — no custom native UI to write. The user sees the
   OS share sheet, taps our icon, and the app foregrounds directly into `quickLog`; no
   intermediate extension screen.
5. **No backend/frontend logic changes anticipated.** `useShareIntentRouter` is
   platform-agnostic already; this spec's implementation work is `app.json` config +
   native project regeneration + verification. If on-device testing surfaces an
   iOS-specific gap in the hook (e.g. a payload shape difference), that becomes a
   scoped fix within this spec, not a new one.
6. **Build method, Simulator step (revised after T3's blocker)**: use **EAS Build**
   (cloud) for the Simulator build/verify step (T3/T4) instead of local `run:ios`.
   Reverses the original "local is sufficient, EAS out of scope" decision — that
   assumption broke once local Xcode proved incompatible with this Expo SDK version.
   EAS Simulator builds are free (no paid Apple Developer Program membership needed),
   using a free Expo account instead. **Physical-device building (T5/T6) is not
   included in this reversal**: EAS device builds need a paid Apple Developer Program
   account for its remote credential/provisioning flow (unlike Xcode's local free
   Personal Team signing), so T5/T6 stay blocked until either (a) local Xcode is
   fixed/updated, or (b) you decide to enroll in the Apple Developer Program. See Open
   Question 3.

## Tech Stack / New Dependencies

- No new packages in the app itself. `expo-share-intent` (already installed, v8.0.1)
  already ships iOS Share Extension support — it's currently suppressed via
  `disableIOS: true` in `frontend/app.json`.
- **`eas-cli`** (new, invoked via `npx`, not installed as a project dependency) and a
  free Expo account — needed for the Simulator build step per Decision 6. Adds
  `frontend/eas.json` (new file) and `extra.eas.projectId` to `frontend/app.json`,
  associating this project with an Expo.dev cloud project.
- Xcode 26.3 (confirmed already installed on this machine) is **insufficient** for a
  local build of this Expo SDK version — see Open Question 3. No separate Android-style
  SDK/toolchain install is needed for the EAS path; the cloud build environment
  supplies its own compatible Xcode.
- One patch already applied and committed independent of this spec's own scope:
  `expo-modules-jsi`'s `RuntimeScheduler.h` needed a 2-line fix
  (`frontend/patches/expo-modules-jsi+57.1.0.patch`, via `patch-package`) for a
  genuine, upstream-acknowledged bug — kept regardless of the EAS pivot since it's
  correct on its own merits and EAS's build environment may hit the same issue too.

## Commands

```
cd frontend
npx expo prebuild --platform ios --clean   # regenerate native project + extension target (done, T2)

# Simulator build (T3/T4) — via EAS, per Decision 6:
npx eas-cli login                           # one-time, free Expo account
npx eas-cli project:init --account <you> --non-interactive   # build:configure's
                                             # interactive prompt needs a real TTY;
                                             # this creates/links the EAS project instead
# then hand-write eas.json (build:configure's other job, since it never got that far)
npx eas-cli build --profile preview --platform ios --non-interactive   # cloud build (preview, not development -- avoids needing expo-dev-client)
# or, to build and auto-install to a booted local Simulator in one step:
npx eas-cli build:run -p ios --latest --profile preview

# Physical device (T5/T6) — local, once unblocked (see Open Question 3):
npx expo run:ios --device
```

In Xcode (one-time per machine, for the eventual physical-device step): Settings →
Accounts → add Apple ID → select it as the team for both the main app target and the
share-extension target.

Existing dev/test/lint commands (`npx expo start`, `npm run lint`, `npx tsc --noEmit`,
`npx jest`, backend `python manage.py test`) all still apply unchanged.

## Project Structure (changes only)

```
frontend/
  app.json     → flip `disableIOS: true` to false/removed; add `iosAppGroupIdentifier`
                 (T1, done); add `extra.eas.projectId` (T3, new per Decision 6)
  eas.json     → new (T3) — build profiles; preview profile's ios config set to
                 `"simulator": true`
  ios/         → regenerated by prebuild (gitignored, disposable — same as android/ was)
  patches/     → new: expo-modules-jsi+57.1.0.patch (RuntimeScheduler fix, unrelated
                 to this spec's own scope but required to get this far — see Tech Stack)
```

No new source files expected. `src/hooks/useShareIntentRouter.ts`,
`src/lib/shareIntent.ts`, `src/api/videos.ts`, and the backend endpoint are reused
unchanged.

## Code Style

N/A beyond existing conventions — this spec's only anticipated diff is a config change
in `app.json`:

```json
[
  "expo-share-intent",
  {
    "androidIntentFilters": ["text/*"],
    "iosAppGroupIdentifier": "group.com.hillarydunkley.frontend.shareintent"
  }
]
```

(`disableIOS: true` removed entirely rather than set to `false`, since `false` is
already the plugin's default.)

## Testing Strategy

- **No new unit tests anticipated** — `useShareIntentRouter`'s existing 8 tests
  already cover the resolve/navigate/sign-in-resume/error-alert logic in a
  platform-agnostic way (they mock `useShareIntentContext()` directly, not the native
  module), and that logic doesn't change here.
- **This module is manual-verification-heavy by nature**, same as Android's T5/T6:
  no automated test can drive a real OS share sheet or Share Extension target.
  Verification plan (per your "both" answer):
  1. **Simulator, via EAS** (Decision 6): `expo prebuild --platform ios --clean`
     generates the expected `NSExtension` entry in the extension's `Info.plist` and the
     App Group entitlement on both targets, with no conflicts against existing plugins
     (expo-router, expo-splash-screen, expo-secure-store, datetimepicker) — inspected
     directly (T2, done). Then `eas build --profile preview --platform ios`
     (Simulator target) builds in the cloud since local `run:ios` is blocked; install
     the artifact to Simulator and share a URL from Safari or Notes to the app
     (substitutes for YouTube, which isn't installable there), confirming: (a) signed
     out → app foregrounds, share is held, no crash; (b) signed in → lands on
     `quickLog` with the correct video resolved.
  2. **Physical device, real YouTube app**: repeat the same two cases (signed out →
     resume after sign-in; signed in → direct) sharing from the actual YouTube iOS app,
     as the final honest end-to-end check before calling this done. **Blocked** until
     Open Question 3 is resolved (local Xcode fix, or Apple Developer Program
     enrollment for EAS device builds).
- Existing gates (`npx tsc --noEmit`, `npm run lint`, `npx jest`,
  `npx expo export --platform web`, `python manage.py test`) must stay green
  throughout — `expo export --platform web` in particular confirms enabling the iOS
  extension doesn't regress the web build.

## Boundaries

- **Always do**: keep the App Group identifier consistent across both targets (the
  plugin manages this, but verify it in the generated entitlements after every
  `prebuild --clean`); keep `ios/` gitignored and disposable — never hand-edit
  generated Xcode project files and expect them to survive a clean prebuild.
- **Ask first**: registering an actual App ID / App Group in an Apple Developer account
  (vs. Xcode's local auto-provisioning) if free Personal Team signing turns out to be
  insufficient for some reason encountered during implementation; any change to
  `app.json`'s `scheme` or `bundleIdentifier`; enrolling in the paid Apple Developer
  Program to unblock EAS device builds (T5/T6) — a real recurring cost decision, not
  something to do implicitly.
- **Watch for** (specific to the EAS pivot, per a known issue in `expo-share-intent`'s
  own tracker — achorein/expo-share-intent-demo#1): `eas build:configure` or EAS's
  credential auto-configuration may inject a redundant
  `build.experimental.ios.appExtensions` block into `app.json` for the `ShareExtension`
  target. Remove it if it appears — the config plugin already fully defines that target
  during `prebuild`, and the two mechanisms conflict when both are present. Only
  `extra.eas.projectId` should remain from EAS's auto-configuration.
- **Never do**: commit the regenerated `ios/` directory; introduce a second,
  iOS-specific code path in `useShareIntentRouter` or the API layer — if the hook needs
  a change to work on iOS, it should stay one hook that works on both platforms.

## Success Criteria

- [ ] `expo prebuild --platform ios --clean` generates a Share Extension target with
      the expected `NSExtension`/activation-rule config in `Info.plist` and a matching
      App Group entitlement on both the main app and extension targets, with no
      conflicts against existing plugins.
- [ ] Sharing a URL from Safari/Notes to Visual Arguments in the iOS Simulator (via an
      EAS-built artifact, per Decision 6) lands on `quickLog` for that video when
      signed in, and holds-then-resumes correctly when signed out — mirroring
      Android's T5/T6 behavior exactly, no code branching by platform.
- [ ] Sharing a YouTube video from the real YouTube iOS app on a physical device,
      signed in, lands on `quickLog` for that exact video with the correct
      title/thumbnail populated. **Blocked on Open Question 3** — not required for
      this spec to be considered functionally proven, but tracked here as the final
      honest end-to-end check, to complete once unblocked.
- [ ] The same physical-device check for the signed-out → sign-in → resume path.
      Same blocked status as above.
- [ ] `expo export --platform web`, `tsc --noEmit`, `npm run lint`, `npx jest`, and
      `python manage.py test` all stay green.
- [ ] No new iOS-specific branches introduced in `useShareIntentRouter` or the API
      layer — confirms the "write it once for both platforms" assumption from the
      original spec held.

## Open Questions

1. **7-day profile expiry cadence**: during implementation, plan to re-run
   `npx expo run:ios` to the physical device periodically if verification spans more
   than a week. Not a blocker, just a scheduling note. (Applies once T5/T6 unblock.)
2. **`iosHideView` transparent hand-off**: confirm during Simulator testing that this
   doesn't produce a visible flash/flicker on this iOS version (26.x) before accepting
   the plugin's default — if it does, revisit decision 4 above.
3. **How T5/T6 (physical device) eventually get unblocked** — three paths, none
   decided yet:
   a. **Wait** for Expo to ship an official Expo SDK 57 fix for the Xcode 26.3/Swift
      6.2 incompatibility (tracked upstream: github.com/expo/expo#50067 — fixed —
      and github.com/expo/expo#50470 — open, unresolved as of this writing).
   b. **Upgrade** to Xcode 26.4+, which requires a macOS Sequoia → Tahoe 26.2 major
      upgrade — a whole-machine change well beyond this feature's scope, high
      time/disk cost, not easily reversible. Not recommended purely to unblock this
      feature.
   c. **Enroll** in the paid Apple Developer Program ($99/yr) to use EAS's remote
      credential flow for device builds instead of local Xcode entirely.
   No action needed until you decide; T5/T6 stay parked in
   `tasks/todo-share-to-app-ios.md` until then.
