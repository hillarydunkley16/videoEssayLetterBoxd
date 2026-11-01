# Spec: Largest Contentful Paint (LCP) for the web app

Follow-up to `SPEC-ttsr.md` (First Paint 14.4s → 1.37s). That spec left LCP out of scope; this one is about it.
Does not overwrite `SPEC.md` (deployment) or `SPEC-ttsr.md`.

## Objective

Make the signed-out home page's largest element appear fast on a slow phone connection.

- **Who:** first-time visitors on the web build (`videoessay-web`), usually on mobile.
- **Why:** after TTSR the page paints at ~1.4s but the real content ("Track every video essay that
  rewired how you watch.") only shows at ~12.4s. The user sees a skeleton for 11 seconds.
- **Success:** LCP < 4s (Lighthouse "needs improvement" ceiling), with First Paint and CLS not regressing.

### What the data says (After-T4 build, `/tmp/lh-after-t4b`)

| Fact | Value |
|---|---|
| LCP element | the hero `<h1>` text in `SignedOutHomeScreen` (Fraunces), not an image |
| LCP breakdown | TTFB 5 ms + **element render delay 12,275 ms** (no resource to load; it is purely "waiting to render") |
| Entry bundle | `entry-*.js`, 4.0 MB raw / **996 kB transferred**, finishes at ~7s on Slow 4G |
| Icon font | `MaterialCommunityIcons.ttf`, **562 kB**, finishes at ~17s |
| Clerk chain | ~5 sequential requests (clerk-js 121 + 91 + 49 + 44 kB), finishes at ~15s |
| Gate | `SignedOut`/`SignedIn` render nothing until Clerk's `isLoaded`, so the hero waits for the whole chain |

So the cost is (a) the hero waits for Clerk and (b) the JS needed to render it is huge.

### Assumptions (correct me if wrong)

1. Measured on the **local production export** first, then the deployed URL. Dev Clerk keys are used now; prod keys may load differently.
2. The signed-out hero is the LCP target. Signed-in users' first screen is not measured here (their feed needs API data).
3. A signed-in user may briefly see the signed-out hero before the feed replaces it (chosen: "render hero immediately, swap if signed in").
4. Web only. Native apps are untouched.
5. "No new runtime dependencies" stays, as in `SPEC-ttsr.md`. Dev tooling for bundle analysis is allowed only if it is not shipped.

## Measurement (the contract)

Same method as `SPEC-ttsr.md`: `bash frontend/scripts/lh-median.sh <url> <fresh outdir> 5`, devtools (applied)
throttling, median of 5. One run at a time, a fresh outdir every time. Report LCP, First Paint, FCP, Speed Index,
TBT, CLS. If the script needs to expose the LCP element and its render-delay, extend it (small change).

Record every run in a Measurements table in `tasks/todo-lcp.md`, starting with a fresh baseline from the current `dist/`.

## Targets

| Metric | Today | Target |
|---|---|---|
| LCP (local export) | ~12.4s | **< 4s** |
| First Paint | 1.37s | stays < 1.5s |
| FCP | 1.37s | stays < 1.8s |
| CLS | 0.01 | stays < 0.1 |
| TBT | ~600 ms | no worse than today (improving is a bonus) |

## Levers in scope

1. **Pre-render the hero into the static HTML.** The signed-out hero should be in the exported HTML so LCP
   happens at about First Paint instead of after hydration. Hydration then takes over without a visible change.
2. **Stop gating the hero on Clerk.** Render the signed-out hero immediately; once Clerk reports signed in, swap to the feed.
3. **Bundle analysis, then splitting.** Find what is in the 4 MB bundle and lazy-load heavy routes/libraries
   (only what the home page doesn't need). Analysis comes before any split, so each split is justified by numbers.
4. **Icon font.** `MaterialCommunityIcons.ttf` (562 kB) is used for a handful of icons; subset it or replace
   those icons with inline SVG on web.
5. **Clerk loading.** Look at deferring or starting Clerk earlier/in parallel so signed-in users reach their feed sooner.
   Only change loading behavior if the measurement shows a gain; the Clerk chain is third-party code.

Order is by expected win per risk: 1 and 2 are the main LCP fix; 3–5 reduce TBT and help signed-in users.

## Commands

```
cd frontend
npm test                                  # jest
npx tsc --noEmit
npm run lint
npx expo export --platform web            # -> dist/
npx serve dist -l 4173                    # serve the export
bash scripts/lh-median.sh http://localhost:4173/ /tmp/lh-<label> 5
```

Bundle analysis (dev only, not shipped): `npx expo export --platform web --source-maps` and inspect with
a source-map explorer run via `npx` (no `package.json` change).

## Project structure

```
frontend/app/+html.tsx                        document shell (critical CSS, fonts)
frontend/app/(home)/index.tsx                 SignedOut / SignedIn branches
frontend/src/screens/SignedOutHomeScreen.tsx  the hero (LCP element)
frontend/components/ui/WebShellSkeleton.tsx   shell shown while Clerk loads
frontend/scripts/lh-median.sh                 measurement script
tasks/plan-lcp.md, tasks/todo-lcp.md          plan and task list (to be created by /plan)
```

## Code style and testing

Match the surrounding code (see `SPEC-ttsr.md`: small focused components, tests next to the code in `__tests__`).
Each behavior change gets a failing test first (jest-expo / RNTL; `renderToStaticMarkup` for static-HTML assertions).
Typical tests: the exported/server-rendered home route contains the hero text; with Clerk not loaded the hero renders;
with Clerk loaded and signed in the feed replaces it; with Clerk loaded and signed out the hero stays.
Gates for every task: full jest, `tsc --noEmit`, lint (0 errors), `expo export --platform web` succeeds.
Performance claims need a recorded Lighthouse median, not a hunch.

## Boundaries

- **Always:** measure before and after each lever; keep tests green; one commit per task; keep CLS < 0.1; keep light and dark themes both correct on first paint.
- **Ask first:** adding any dependency (even dev); changing auth behavior beyond the hero un-gating; changing `render.yaml`; pushing the deploy branch.
- **Never:** hardcode Clerk issuer/keys/backend URLs; break signed-in or native behavior; commit secrets; skip or delete tests; touch the unfinished `tasks/plan.md` / `tasks/todo.md` or the untracked GraphQL work.

## Success criteria

- [ ] LCP median < 4s on the local export (5 runs), recorded in `tasks/todo-lcp.md`
- [ ] First Paint < 1.5s, FCP < 1.8s, CLS < 0.1 still hold
- [ ] Signed-out visitors see the hero text in the first HTML (verified in `dist/index.html`)
- [ ] Signed-in users still land on their feed; no hydration warnings; both themes correct
- [ ] Each bundle/icon change is backed by a before/after size or Lighthouse number
- [ ] Deployed-URL numbers recorded (needs your go-ahead to deploy)

## Open questions

1. **Pre-rendering and hydration.** Expo static output pre-renders routes, but Clerk's components render nothing server-side.
   Whether the hero can live in the static HTML without a hydration mismatch is the main technical risk, and the first
   task should be a small spike that proves it either way.
2. **Signed-in flash.** A returning signed-in user briefly sees the hero before the feed. If that is not acceptable, we can
   add a localStorage "was signed in" hint later (not in scope now).
3. **Local vs deployed.** Render's CDN will change TTFB and compression; confirm the targets on the deployed URL in the last task.
4. **Prod Clerk keys.** The Clerk chain differs between dev and prod instances; re-measure after the production cutover.
