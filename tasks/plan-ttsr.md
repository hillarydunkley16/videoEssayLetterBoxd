# Implementation Plan: Time to Start Render (web)

Spec: `SPEC-ttsr.md`. Task list: `tasks/todo-ttsr.md`. Separate from the closed-beta
deploy plan in `tasks/plan.md` / `tasks/todo.md`, which still has open tasks.

## Overview

The web build paints nothing useful until the JS bundle has loaded and Clerk's
`isLoaded` is true (`app/_layout.tsx` returns `null`), and the Google Fonts
stylesheet in `app/+html.tsx` blocks rendering. Goal: observed First Paint
< 1.5s (Lighthouse's stand-in for Start Render) and FCP < 1.8s under applied Slow 4G / 4x CPU throttling, with no layout shift and no
change to signed-in/signed-out behavior.

## Findings from the codebase

- `SignedIn` / `SignedOut` render nothing until Clerk loads, so dropping the
  `null` gate alone still leaves a blank content area.
- `WebNav` already uses `SignedIn`/`SignedOut`, so it is safe to render pre-auth.
- Screens call `useAuth`/`useUser` and fetch with tokens. Mounting `<Stack>` before
  Clerk loads could trigger authed fetches or redirects with an undefined user.
- Fonts in use: Fraunces 400/500/600, Inter 400/500/600 (native loads these via
  `use-app-fonts.ts`); the Google link also requests Inter 700.
- `@expo-google-fonts/*` ship TTF only, so woff2 must be produced from them.
- Expo copies `frontend/public/` verbatim into `dist/`; there is no `public/` yet.
- `web.output: "static"` pre-renders each route at export, so whatever the layout
  renders while `isLoaded` is false is what ends up in the static HTML.

## Baseline findings (T1)

- Pre-rendered `dist/index.html` body is an empty `<div id="root">`; entry bundle is 4.1 MB.
- Observed first paint is 2.1-3.5s locally, and equals FCP/LCP, so nothing paints before
  JS + Clerk's script chain finish. Simulated FCP (1.7s median) is bimodal and misleading.
- Expo injects `preload as=font` for six TTFs because `use-app-fonts.ts` is bundled on web.
- Applied-throttling baseline: **First Paint 14.4s** (~150ms spread), Speed Index 14.7s, TBT 42ms,
  CLS 0.01. The shell must be in the pre-rendered HTML; Google Fonts CSS may hold First Paint
  above 1.5s until T4.
- Metric decided: observed First Paint under applied throttling (`--throttling-method=devtools`),
  plus FCP and Speed Index. The simulated baseline above is NOT comparable and must be re-run.

## Architecture decisions

1. **Shell + skeleton replaces `<Stack>` while `!isLoaded` on web.** Route
   components mount only after Clerk loads, exactly as today, so auth-dependent
   behavior is unchanged. The shell (`WebNav` + themed container) paints
   immediately and is baked into the pre-rendered HTML.
2. **Native path untouched:** the `fontsLoaded && isLoaded` gate stays for iOS/Android.
3. **Self-host fonts by converting the already-installed TTFs to woff2** (fonttools,
   one-off, script not committed). No new runtime dependency. Output goes in
   `frontend/public/fonts/` with versioned filenames so it can be cached immutably.
4. **Critical CSS is inline in `+html.tsx`**, using the same tokens as
   `constants/theme.ts` (`paper` / `ink`), switched by `prefers-color-scheme`.
5. **Cache headers via `render.yaml` `headers`**, guarded by a content test in the
   existing per-concern backend test style.

## Dependency graph

```
T1 baseline ──► T2 shell paints before Clerk ──► T3 critical CSS ──► T4 self-hosted fonts ─┐
      └────────────────────────────────────────► T5 cache headers (independent) ──────────┤
                                                                                           ▼
                                                                        T6 after-measurement + decision
```

T5 touches only `render.yaml` and a backend test, so it can run in parallel with T2-T4.
T3 and T4 both edit `+html.tsx`, so they are sequential.

## Task list

### Phase 1: Measure
- [ ] T1: Baseline measurement and confirm the empty-shell hypothesis (no code)

### Phase 2: Paint something sooner
- [ ] T2: Web shell + skeleton paints before Clerk loads
- [ ] T3: Inline critical CSS (themed background, no white/dark flash)

### Checkpoint A
- [ ] Gates pass; `dist/index.html` contains nav/skeleton markup; Lighthouse shows the improvement vs T1

### Phase 3: Remove the render-blocking third party
- [ ] T4: Self-host Fraunces + Inter, preload, remove the Google Fonts link

### Phase 4: Caching
- [ ] T5: Immutable cache headers for hashed assets and fonts

### Checkpoint B
- [ ] Gates pass; no request to `fonts.googleapis.com` / `fonts.gstatic.com`; headers present

### Phase 5: Verify
- [ ] T6: After-measurement on local build and deployed URL; decide on follow-ups

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clerk provider misbehaves during static export with the new shell | High | Run `expo export` in T2 and inspect `dist/index.html`; Clerk already renders at export today |
| Hydration mismatch between pre-rendered shell and first client render | Med | Skeleton is deterministic (no `Date`, no auth state); check the console on load in T2 |
| Layout shift when skeleton is replaced by real content or fonts swap | Med | Fixed nav height in the skeleton; fallback font metrics via `size-adjust` in T4; CLS checked in Lighthouse |
| Static `fraunces` TTF lacks the `opsz` axis that Google's CSS served | Low | Compare headings visually in T4; if it regresses, ask before adding a variable-font source |
| Render `headers` syntax or path matching differs from expectation | Med | Validate with `render blueprints validate` if the CLI is installed; confirm headers with `curl -I` after deploy in T6 |
| Lighthouse variance | Low | Median of 5 runs for every recorded number |
| Local `serve` is not the Render CDN | Low | T6 repeats measurement on the deployed URL |

## Open questions

- Which fonts to preload (decided in T4 from the measured above-the-fold usage;
  default Inter 400 + Fraunces 500, max 3 files).
- Deploying for T6 means pushing the deploy branch. I'll confirm with you before that step.
