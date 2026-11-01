# Implementation Plan: LCP for the web app

Spec: `SPEC-lcp.md`. Follows `tasks/plan-ttsr.md` (done through T5; T6 pending). Task list: `tasks/todo-lcp.md`.
`tasks/plan.md` / `tasks/todo.md` (closed-beta deploy) are a different, unfinished plan and are not touched.

## Overview

Signed-out home LCP is ~12.4s (target < 4s). The LCP element is the hero `<h1>`; its whole delay is
"element render delay": the hero is behind Clerk's `isLoaded`, and the 4 MB bundle must also run first.
Phase 1 puts the hero in the static HTML and keeps it on screen through hydration, which should move LCP to roughly
First Paint (~1.4s). Phase 2 (bundle, icon font, Clerk) mainly improves TBT and signed-in users, and is only worth doing
if Checkpoint A shows it is needed.

## What the code looks like today (read for this plan)

- `app/_layout.tsx`: on web, `isWeb && !isLoaded` renders `WebShellSkeleton` instead of `<Stack>`. So `/` is exported
  with the skeleton, and `dist/index.html` has no hero text.
- `app/(home)/index.tsx`: `<SignedOut><SignedOutHomeScreen/></SignedOut>` and `<SignedIn>…feed…</SignedIn>`. Both render
  nothing until Clerk loads.
- `src/screens/SignedOutHomeScreen.tsx`: the hero (`Text` headline in `Fonts.display`). Its "Popular this week" section
  is fetched in an effect, so it never appears in static HTML (fine; it is below the hero).
- Static export is per-route (`dist/search.html`, `dist/profile.html`, …), each with the skeleton baked in.
- `MaterialCommunityIcons` is imported in ~14 files; its 562 kB TTF is fetched at runtime.

## Architecture decisions

- **Hero un-gating is scoped to the home route.** Un-gating the root `<Stack>` for every route would let screens that
  expect a loaded Clerk (tokens, `useUser`) render too early. Other routes keep the skeleton until Clerk loads.
- **The server and the first client render must match.** On web, while Clerk is not loaded, the home route renders the
  signed-out hero in both. Hydration then reuses the DOM, so the LCP element is not replaced. A signed-in user gets the
  feed once Clerk reports signed in (brief hero flash, accepted in the spec).
- **Phase 2 is gated by data.** Bundle splitting, the icon font and Clerk changes each need a measurement that justifies them.

## Dependency graph

```
T1 hero in static HTML, not gated on Clerk ──> T2 signed-in swap + regression checks ──> Checkpoint A (LCP < 4s?)
                                                                                           │
                                          ┌────────────────────────────────────────────────┤ only if worthwhile
                                          v                    v                           v
                                   T3 bundle analysis    T4 icon font               T5 Clerk loading (measure first)
                                          │
                                          v
                                   T6 bundle splits (scoped from T3)
                                          └──────────────> Checkpoint B ──> T7 final + deployed measurement
```

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hydration mismatch (Clerk renders nothing server-side) | High: blocks the main win | T1 is the risk-first slice; if it mismatches, stop and replan before anything else |
| Signed-in users see hero then feed | Medium: visible flash | Accepted in spec; T2 verifies the swap; a localStorage hint is a later option |
| Hero font weight not preloaded → late swap → CLS | Medium | T1 checks which Fraunces weight the headline uses and preloads it if needed (lesson from TTSR T4) |
| Dark mode light flash on the hero | Medium | The `+html.tsx` critical CSS already recolors inline-light shell colors; T1 verifies hero colors are covered |
| Pre-rendered hero ≠ client hero because of `useColorScheme` (light until hydration) | Low | Same mechanism as the skeleton; covered by existing attribute-selector overrides, re-checked in T1 |
| Splitting breaks routes/native | High | Phase 2 only after data; web-only, full jest + export + manual route check per split |
| Deployed numbers differ from local | Medium | Final task measures the deployed URL (needs deploy approval) |

## Open questions

- Is Checkpoint A's LCP already < 4s? If so, Phase 2 becomes optional hardening, not required.
- Which exact icons does the app use (T4 inventory), and can they all be SVG on web?
