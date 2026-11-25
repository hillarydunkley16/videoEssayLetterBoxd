# Implementation Plan: Share-to-App — iOS (Share Extension)

Traces to `tasks/spec-share-to-app-ios.md`. Branch `v2`. Task list:
`tasks/todo-share-to-app-ios.md`. Distinct from `tasks/plan.md`/`tasks/todo.md`
(unrelated in-flight deploy work — do not touch those) and from the already-shipped
`tasks/plan-share-to-app.md`/`tasks/todo-share-to-app.md` (Android).

## Dependency Graph

```
T1 app.json config (flip disableIOS off, set iosAppGroupIdentifier) — done
   └─→ T2 prebuild --platform ios --clean, inspect generated Info.plist/entitlements — done
          └─→ [BLOCKER] local `run:ios` incompatible with this machine's Xcode/SDK combo
                 (Xcode 26.3 < Expo SDK 57's documented min of 26.4+; 26.4+ requires a
                 macOS Sequoia→Tahoe upgrade — see spec Open Question 3). One real bug
                 found/fixed along the way (expo-modules-jsi RuntimeScheduler patch);
                 a second, upstream-unresolved Swift 6.2 concurrency issue remains.
                 └─→ T3 EAS project setup + cloud Simulator build (pivot — see spec
                        Decision 6; supersedes the original "local signing" T3)
                        └─→ T4 Simulator verification (Safari/Notes share, signed-in +
                               signed-out), using the EAS-built artifact
                               └─→ Checkpoint A: core mechanism confirmed on Simulator
                                      └─→ [PARKED] T5 physical device signing + build
                                             — blocked on spec Open Question 3 (local
                                             fix, macOS upgrade, or Apple Developer
                                             Program enrollment for EAS device builds);
                                             no further work here until you decide
                                             └╌╌→ T6 physical-device verification (parked with T5)
                                                    └╌╌→ Checkpoint B (parked with T5/T6)
                                                           └─→ T7 full gate re-run + sign-off
                                                                 (Simulator-scoped until
                                                                 T5/T6 unblock)
```

Mostly sequential, with one branch point: T3 onward pivots from local builds to EAS
for the Simulator path (T3/T4/Checkpoint A/T7), while T5/T6/Checkpoint B are parked
rather than cancelled — they resume from wherever this dependency chain left off once
Open Question 3 is resolved, they don't need re-planning.

## Vertical Slices (why this order)

1. **T1 (config) before T2 (prebuild)**: a one-line `app.json` change first, so the
   very next step's generated output can be inspected against it — same discipline as
   Android's T5 (diff the generated manifest before trusting it).
2. **T2 (inspect) before T3 (build)**: catch a config-plugin conflict (per the original
   spec's risk list — expo-router, expo-splash-screen, expo-secure-store,
   datetimepicker are all already registered) by reading the generated
   `Info.plist`/entitlements directly, before spending time on a build that might fail
   for the same underlying reason.
3. **T3+T4 (Simulator) before T5+T6 (physical device)**: Simulator lets you validate
   the extension target, App Group handoff, and `useShareIntentRouter`'s behavior via
   Safari/Notes sharing with zero signing friction beyond the one-time Personal Team
   setup, and no 7-day profile-expiry clock running. Only once that's proven does it
   make sense to spend the device-signing setup and re-run cadence on the real
   YouTube-app check — cheapest place to find a problem is Simulator, not device.
4. **Checkpoint A gates T5**: don't move to physical-device signing until the
   mechanism itself (share → app → quickLog, both signed-in and signed-out) is proven
   working in Simulator — mirrors Android's Checkpoint B gating T6.
5. **T7 last**: same role as Android's T7 — full gate re-run and Success Criteria
   sign-off once the risky, manual, device-dependent work is done.
6. **T3 pivots to EAS, T5/T6 park rather than adapt**: once local `run:ios` proved
   incompatible with this machine's toolchain, the cheapest path forward was routing
   the Simulator step around the blocker (EAS controls its own build environment) —
   that step doesn't need local signing at all, so EAS's free tier fully covers it.
   Physical-device work has no equivalent free workaround (EAS device credentials need
   a paid Apple Developer Program account), so rather than force a decision on that
   spend mid-implementation, T5/T6 are parked as their own decision point, not silently
   reinterpreted or dropped.

## Risks & Mitigations

- **Config-plugin conflict (T2)**: `expo-share-intent`'s iOS plugin edits the same
  `Info.plist`/entitlements files that `expo-splash-screen` and `expo-secure-store`
  also touch. Mitigation: run `prebuild --clean` and read the generated files before
  building — same approach that de-risked Android's T5, and the README's own
  "Config sync failed" troubleshooting entry suggests this is a known friction point
  for this specific plugin.
- **iosHideView flash (spec's open question 2)**: the transparent hand-off view might
  not be perfectly seamless on iOS 26.x. Mitigation: explicitly watch for this during
  T4 (Simulator) verification, before it's harder to iterate on with a physical device
  in the loop.
- **Free-tier profile expiry (spec decision 1)**: a physical-device install goes stale
  after 7 days. Mitigation: do T5/T6 (device work) in one sitting where possible, and
  if verification stretches past a week, budget one `npx expo run:ios` re-install
  rather than treating an expired-profile failure as a new bug.
- **Hidden iOS-specific gap in `useShareIntentRouter`**: the spec assumes the hook
  needs zero changes. Mitigation: if Simulator testing (T4) reveals the shared payload
  shape differs from Android in some way the hook doesn't handle, fix it there as a
  scoped addition to T4 rather than letting it block through to device testing
  undiagnosed — per the spec's Boundaries, it must stay one hook, not branch by
  platform.
- **Realized risk, not just a mitigation plan (T3)**: local Xcode 26.3 turned out to be
  below Expo SDK 57's documented minimum (26.4+, which itself needs a macOS Sequoia→
  Tahoe upgrade). One genuine bug was found and fixed along the way
  (`expo-modules-jsi`'s `RuntimeScheduler.h`, patched via `patch-package`, matches an
  upstream-merged fix). A second wave of Swift 6.2 strict-concurrency errors in the
  same package is open and unresolved upstream — attempting to force the package to
  Swift language mode 5 as a workaround did *not* converge (traded one set of errors
  for two different new ones) and was reverted. Mitigation adopted: pivot the
  Simulator step to EAS Build (its own managed, compatible Xcode image) rather than
  keep patching an open upstream issue blind.
- **EAS + multi-target config conflict (T3)**: `expo-share-intent`'s own issue tracker
  (achorein/expo-share-intent-demo#1) documents EAS's build-configure step sometimes
  injecting a redundant `build.experimental.ios.appExtensions` block for the
  `ShareExtension` target, conflicting with the config plugin's own target definition.
  Mitigation: check `app.json` after `eas build:configure` and remove that block if
  present, keeping only `extra.eas.projectId`.
- **Physical-device path has no free EAS equivalent**: unlike the Simulator pivot,
  EAS device builds require a paid Apple Developer Program account for remote
  credential management. Mitigation: don't spend that money implicitly — T5/T6 are
  parked as an explicit decision point (spec Open Question 3), not silently resolved
  by extending the EAS pivot to cover them too.

## Checkpoints

- **After T2**: generated `Info.plist`/entitlements inspected and confirmed correct
  before attempting a build — stop and fix config here if anything looks wrong, don't
  debug it via a failed Xcode build. (Done — this is what surfaced the T3 blocker.)
- **Checkpoint A (after T4)**: core mechanism confirmed working end-to-end in
  Simulator (both signed-in and signed-out cases), now via an EAS-built artifact
  rather than a local build — before considering physical-device signing at all.
- **Checkpoint B (after T6)**: real YouTube app, real device, both cases confirmed —
  the final "is this actually done" gate before T7's paperwork. **Parked** along with
  T5/T6 until spec Open Question 3 is resolved.
- **After T7**: full gate run (backend `manage.py test`, frontend `npx jest`,
  `tsc --noEmit`, `npm run lint`, `npx expo export --platform web`) — final sign-off,
  same as Android's, scoped to what T1-T4/Checkpoint A actually verified (Simulator)
  until T5/T6 unblock and T7 can be revisited for the physical-device criteria too.
