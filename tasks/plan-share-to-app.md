# Implementation Plan: Share-to-App (YouTube Share Sheet → Start a Log)

Traces to `tasks/spec-share-to-app.md`. Branch `v2`. Task list: `tasks/todo-share-to-app.md`.
Distinct from the in-flight deploy work in `tasks/plan.md`/`tasks/todo.md` — do not touch those.

## Dependency Graph

```
T1 oEmbed service (backend, pure fn)
   └─→ T2 get-or-create endpoint (backend, uses T1)
          └─→ T3 frontend API client fn (calls T2)
                 └─→ T4 shared-URL parser (pure fn, no dependency on T1-T3, can build in parallel)
                        └─→ T5 share-intent plugin + listener wiring (uses T4, calls T3)
                               └─→ T6 signed-out resume flow (uses T5's listener + existing (auth) routes)
                                      └─→ T7 manual dev-client verification (needs T1-T6 all done)
```

T4 has no backend dependency and can be built/tested independently and in parallel with
T1-T3. Everything else is sequential — each slice is end-to-end runnable on its own
(T2 is a curl-able endpoint before any frontend exists; T5 is a working share→app→log
screen before sign-out handling is added).

## Vertical Slices (why this order)

1. **T1+T2 first**: the backend get-or-create endpoint is independently testable via
   `manage.py test` / curl with no native build required — cheapest place to find
   oEmbed-shape surprises (error format, missing fields) before any frontend code
   depends on it.
2. **T3+T4 next**: pure frontend logic, testable in `jest` without a device or native
   rebuild. T4 (URL parsing) is genuinely parallel to T1-T3 and can be picked up by
   whoever's free.
3. **T5**: the first point requiring `expo prebuild`/dev-client — deliberately last
   among the "build" tasks so all the logic it wires together already works in
   isolation. This is the riskiest task (native config, real device needed) — isolate
   it so a config problem doesn't block on unrelated app logic.
4. **T6**: layered on top of a working T5 rather than built alongside it, since it only
   matters for a case (signed-out share) that's easy to defer if T5 already proves the
   core mechanism works.
5. **T7**: manual verification checkpoint — no automated test can drive a real OS share
   sheet.

## Risks & Mitigations

- **Native build risk (T5)**: `expo-share-intent`'s Android setup could conflict with
  existing `app.json` plugins (`expo-router`, `expo-splash-screen`, `expo-secure-store`,
  `@react-native-community/datetimepicker`). Mitigation: run `expo prebuild --clean`
  in a scratch/throwaway state first and diff the generated `AndroidManifest.xml`
  before committing to the approach; if it conflicts, the fallback is a hand-written
  intent filter via a small local config plugin instead of the library.
- **oEmbed gaps (T1)**: oEmbed has no stable "video unavailable" error contract beyond
  HTTP status — verify actual error shape with a live request during T1, don't assume.
- **Pending-share persistence (T6)**: per spec's open question 2, if the Clerk sign-in
  web view can kill the JS runtime, in-memory storage silently loses the pending video.
  Mitigation: spike this explicitly as the first step of T6, not assumed away.
- **get_or_create double-fetch (T1/T2)**: per spec's open question 1, use
  `filter(youtube_id=...).first()` before calling oEmbed, not `get_or_create(defaults=...)`,
  to avoid a wasted HTTP call on the common "already exists" path — decided now so T2
  isn't built the wrong way and re-done.

## Checkpoints

- **After T2**: backend slice fully green (`manage.py test`) — stop and verify via curl
  with a real youtube_id before writing any frontend code against it.
- **After T5**: first end-to-end manual check on an Android dev-client build — confirm
  the core mechanism (share → app → quickLog, essay populated) before adding T6's
  signed-out branch.
- **After T7**: full gate run (backend `manage.py test`, frontend `npx jest`, `tsc --noEmit`,
  `npm run lint`, `npx expo export --platform web`) — final sign-off checkpoint.
