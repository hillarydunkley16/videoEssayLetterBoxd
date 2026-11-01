# TTSR (web start render) — Task List

Plan: `tasks/plan-ttsr.md`. Spec: `SPEC-ttsr.md`. Branch: `v2`.
Run frontend commands from `frontend/`. Record all measurements (median of 5) in the
**Measurements** table at the bottom.

---

## Task 1: Baseline measurement and hypothesis check  ✅ DONE (local; deployed URL deferred)

**Description:** Capture current Start Render / FCP / CLS and confirm the
pre-rendered HTML is an empty shell. No code changes.

**Acceptance criteria:**
- [x] `dist/index.html` inspected; whether it contains nav/content markup is recorded
      — **empty shell**: `<div id="root">` with no nav or content; 4.1 MB entry bundle
- [x] Lighthouse mobile (Slow 4G, 4x CPU) median-of-5 recorded for local `dist/`
      — **simulated throttling; superseded.** Re-run with the updated `lh-median.sh`
      (applied throttling, prints First Paint) and replace the baseline rows below.
- [x] Re-baseline local `dist/` with applied throttling (First Paint, FCP, Speed Index, TBT, CLS)
      — **First Paint 14.4s** (14331-14484 over 5 runs), Speed Index 14.7s, TBT 42ms, CLS 0.01
- [ ] Same recorded for the deployed `videoessay-web` URL — **deferred**: needs the
      deployed URL; run `lh-median.sh` against it and fill the table

**Verification:**
- [x] `npx expo export --platform web` succeeds
- [x] Numbers are in the Measurements table

**Findings (change later tasks):**
- Lighthouse's *simulated* FCP is bimodal (1.7s x3, 6.3s/6.9s x2) and sits below the
  *observed* first paint (2.1s x3, 3.0s, 3.5s), so it cannot be trusted as the success
  metric for this page. Observed FP == FCP == LCP in every run (first paint is real
  content, i.e. nothing paints until JS + Clerk finish). Speed Index (~8.4s) and TBT
  (~944ms) are the steadier signals. **Decision needed:** measure with applied
  throttling (`--throttling-method=devtools`) and report observed first paint.
- **Real baseline (applied throttling): First Paint 14.4s vs the 1.5s target.** Tight spread
  (~150ms), so the number is reliable. The wait is the ~1 MB gzipped bundle + Clerk chain, so
  T2 must put the shell in the *pre-rendered HTML* (visible in `dist/index.html` before any JS
  runs), not just render it after load. The blocking Google Fonts CSS likely keeps First Paint
  above 1.5s until T4, so check the target at Checkpoint B, not only Checkpoint A.
- Clerk's script chain (`clerk.browser.js` -> 4 more files, ~400ms each) gates
  `isLoaded`; this is what T2 stops the first paint from waiting on.
- Expo injects `preload as=font` for six `.ttf` files because `use-app-fonts.ts` is
  bundled on web. Web uses Google Fonts, so these are wasted bandwidth. Added to T4.

**Dependencies:** None
**Files likely touched:** `tasks/todo-ttsr.md` only
**Estimated scope:** XS

---

## Task 2: Web shell + skeleton paints before Clerk loads  ✅ DONE (browser checks pending)

**Description:** In `RootLayoutNav`, on web render the themed container, `WebNav`
and a content skeleton while `!isLoaded`, then swap in `<Stack>`. Native keeps its
current `null` gate. Skeleton uses a fixed nav height and no auth state.

**Acceptance criteria:**
- [x] Web, `isLoaded=false`: nav and skeleton render; `<Stack>` does not mount
- [x] Web, `isLoaded=true`: identical output to today
- [x] Native, `isLoaded=false` or fonts not loaded: still renders `null`
- [x] `dist/index.html` from `expo export` contains the nav/skeleton markup (the shell must be
      visible in the static HTML itself, since the 14.4s baseline is JS + Clerk loading)

**Verification:**
- [x] New jest test (`app/__tests__/_layout.test.tsx`) covers the three cases above
- [x] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web` pass
- [ ] **Not yet done (needs a browser):** manual: serve `dist/`, throttle in DevTools, nav visible before bundle loads; no hydration warnings in console; signed-in and signed-out home still behave correctly

**Dependencies:** T1
**Files likely touched:**
- `frontend/app/_layout.tsx`
- `frontend/components/ui/WebShellSkeleton.tsx` (new)
- `frontend/app/__tests__/_layout.test.tsx` (new)

**Estimated scope:** S

---

**Results:** 4 new tests (228/228 total pass), `tsc` clean, lint 0 errors, export OK.
`dist/index.html` now contains the `watchd` nav bar + skeleton (was an empty `#root`).
Still to check in a real browser: no hydration warnings in the console, and the
signed-in/signed-out home still behave. Re-run `lh-median.sh` to see First Paint after T2
**Measured: First Paint 14.4s -> 3.1s** (FCP 3.1s). LCP is still 14.6s (real content
after JS + Clerk) and Speed Index 12.6s. TBT rose 42 -> 979ms only because FCP now lands
earlier, so the TBT window starts sooner; it is not a regression. Remaining gap to 1.5s:
blocking Google Fonts CSS + six TTF preloads sharing a 1.6 Mbps link (both removed in T4).

## Task 2b: Drop the unused web TTF font preloads  ✅ DONE

**Description:** Split out of T4 to test a hypothesis early: after T2, First Paint is 3.1s
vs the 1.5s target, and Expo injects six `preload as=font` links for `.ttf` files that web
never uses (it takes fonts from the Google Fonts `<link>`). On a 1.6 Mbps throttled link they
may be competing with the HTML/CSS. Add `app/hooks/use-app-fonts.web.ts` returning
`{ loaded: true, error: null }` so the `@expo-google-fonts` TTFs drop out of the web bundle.
Native file unchanged.

**Acceptance criteria:**
- [x] Web `useAppFonts()` returns `{ loaded: true, error: null }` and loads no font files
- [x] The six `.ttf` `preload as=font` links are gone from `dist/index.html`
- [x] Native behavior unchanged (`use-app-fonts.ts` untouched; `_layout` still gates on it)

**Verification:**
- [x] New jest test (`app/__tests__/use-app-fonts.web.test.ts`); `npm test`, `npx tsc --noEmit`, `npm run lint`
- [x] `npx expo export --platform web`; grep `dist/index.html` for `.ttf` -> none
- [x] `lh-median.sh` before/after: **First Paint 3103 -> 1516 ms** (LCP 14.6 -> 11.4s, Speed Index 12.6 -> 9.4s,
      TBT 979 -> 603ms). Confirms the TTF preloads were competing for bandwidth. 1516 ms is ~16ms over the
      1.5s target (2 of 5 runs under), so not yet cleanly met. (Run 1 printed `run 1 failed` but its JSON
      was written and in line with the rest; treated as valid.)
      **Caveat:** the same command was run twice into the same `/tmp/lh-after-t2b` while the first was
      still in the background, so runs 1-3 are shared between both summaries (median 1516 vs 1521 ms,
      range 1415-1670). Read this as First Paint ~1.5s +/- 0.1s, not ten independent runs. Re-measure
      cleanly (one process, fresh output dir) at the next checkpoint.

**Dependencies:** T2
**Files likely touched:**
- `frontend/app/hooks/use-app-fonts.web.ts` (new)
- `frontend/app/__tests__/use-app-fonts.web.test.ts` (new)

**Estimated scope:** XS

---

**Results:** 1 new test (229/229 pass), `tsc` clean, lint clean. `dist/index.html` has no `.ttf`
preload links (only the CSS preload remains).
**Left alone (out of scope):** the 55 TTFs are still emitted into `dist/assets` and referenced from
the bundle, because Expo Router treats `app/hooks/use-app-fonts.ts` as a route file and bundles it
alongside the `.web.ts` stub. Nothing fetches them. Moving `app/hooks/` out of `app/` would drop them
but is a separate refactor.

## Task 3: Inline critical CSS  ✅ DONE

**Description:** Add an inline `<style>` in `+html.tsx` that sets the page background
and text color from the theme tokens (`paper`/`ink`) with a `prefers-color-scheme`
dark variant, so the first paint is never a white flash.

**Heads-up from T2:** `useColorScheme` (web) returns `light` during static render, so the
pre-rendered shell has an inline *light* `background-color` on the layout containers. The
critical CSS must override it in dark mode (e.g. `!important` in a `prefers-color-scheme: dark`
rule) or the shell flashes light until hydration.

**Acceptance criteria:**
- [x] Light and dark first paint use the themed background
- [x] Values match `Colors.light/dark.background` in `constants/theme.ts`

**Verification:**
- [x] `expo export` succeeds; `dist/index.html` contains the style in `<head>`
- [x] Manual (system is in dark mode; DevTools Performance filmstrip, Slow 4G, cache off): frames before
      first paint are black, first painted frame is the dark shell + skeleton, no light/white frame through
      hydration or when real content arrives. (Original wording: with DevTools dark-mode emulation and CPU throttling, no white flash
- [x] `tsc`, `lint` pass

**Dependencies:** T2b
**Files likely touched:** `frontend/app/+html.tsx`
**Estimated scope:** XS

---

## Checkpoint A: After Tasks 1-3
- [ ] All frontend gates pass
- [ ] Pre-rendered HTML shows the shell; Lighthouse median improved vs T1
- [ ] Review with human before proceeding

---

**Results:** 4 new tests (`app/__tests__/html.test.tsx`), 233/233 total pass, `tsc` clean, lint 0 errors
(1 `require()` warning in the new test, same kind the other tests have). The CSS is built from
`Colors` in `+html.tsx`; the exported `dist/index.html` has `<style id="critical-theme">` and all four
override selectors match inline values that really appear in the pre-rendered `<body>`.
Note: this task adds no network change, so expect First Paint to stay ~1.5s; its value is dark mode.

## Task 4: Self-host fonts, preload, remove Google Fonts link  ✅ DONE (browser + Lighthouse checks pending)

**Description:** Convert the installed TTFs (Fraunces 400/500/600, Inter 400/500/600/700)
to woff2 with a one-off fonttools run, place them in `frontend/public/fonts/` with
versioned names, add `@font-face` (`font-display: swap`, fallback with `size-adjust`)
and `<link rel="preload" as="font" crossorigin>` for the above-the-fold weights, and
delete the `fonts.googleapis.com` link. Update the two comments that mention it.

**Acceptance criteria:**
- [x] No network request to `fonts.googleapis.com` / `fonts.gstatic.com` on load
- [ ] Text renders in Fraunces/Inter on web (headings vs body visibly unchanged)
- [x] At most 3 font files preloaded (exactly 1: Fraunces 400, the only font the first-paint shell uses)
- [ ] (The six-TTF-preload removal moved to T2b.)
- [ ] **Pending (Lighthouse):** CLS < 0.1 across the font swap

**Verification:**
- [ ] **Pending (browser):** DevTools Network panel: fonts load from `/fonts/*.woff2` and nothing from Google
- [ ] **Pending (browser):** visual compare of home page headings before/after (screenshot)
- [x] `expo export` copies `public/fonts` to `dist/fonts`; `tsc`, `lint`, `npm test` pass

**Evidence for the target (DevTools Insights, Slow 4G):** "Render-blocking requests: est. savings 1.36s"
(Google Fonts CSS + global CSS). Waterfall: HTML 610ms, then Google CSS 890ms in parallel with global CSS
591ms, so paint waits ~1.5s. Optional extra after T4: inline the 2 KB `global.css` to drop one more round trip.

**Dependencies:** T3
**Files likely touched:**
- `frontend/app/+html.tsx`
- `frontend/public/fonts/*.woff2` (7 binary assets)
- `frontend/constants/theme.ts` (comment only)
- `frontend/app/hooks/use-app-fonts.ts` (comment only)

**Estimated scope:** M

---

**Results:** 16 new tests in `html.test.tsx` (249/249 total pass), `tsc` clean, lint 0 errors.
`dist/index.html`: no third-party hosts, 7 `@font-face`, 1 font preload, all 7 files in `dist/fonts/`.
Sizes: Fraunces ~28 kB each, Inter ~36 kB each (was Google: 68 kB + 48 kB variable files).

**Decisions / differences to know about:**
- Files are Latin + Latin Extended (+ Latin Extended Additional) subsets made once with fontTools from the
  installed TTFs (script not committed). Greek/Cyrillic/other scripts now fall back to the system font; Google's
  CSS would have fetched those subsets on demand.
- OpenType alternates (stylistic sets, `tnum`, etc.) were dropped; default features (kerning, ligatures, ...) kept.
- Inter is four static weights, not one variable file, so a page using all four downloads ~145 kB of Inter
  instead of 48 kB. Only weights actually used are fetched.
- Fraunces is static (no `opsz` axis, unlike Google's variable file) and has no italic file, same as before
  (italic text was already synthesized). Compare headings visually.
- No size-adjusted fallback font was added: CLS was 0.01 before; add one only if CLS regresses.
- To regenerate the fonts: re-run the fontTools subset, write new files with a bumped `-vN` suffix, update
  `FONT_FACES` in `+html.tsx` (the tests check each file exists).

## Task 5: Cache headers on the static site ✅ DONE (deployed effect checked in T6)

**Description:** Add a `headers` block to `videoessay-web` in `render.yaml`:
immutable one-year caching for `/_expo/static/*` and `/fonts/*`, and
`max-age=0, must-revalidate` for HTML. Guard with a content test.

**Acceptance criteria:**
- [x] `render.yaml` defines the three header rules under `videoessay-web`
- [x] Existing blueprint tests still pass

**Verification:**
- [ ] `cd backend && python manage.py test movie_csv.test_render_static_headers movie_csv.test_render_blueprint`
- [ ] `render blueprints validate` (if the CLI is installed)
- [ ] After deploy (T6): `curl -I` on a hashed asset shows the immutable header

**Evidence (DevTools Insights):** "Use efficient cache lifetimes: est. savings 999 kB" (the entry bundle).
Local `serve` is not Render's CDN, so confirm the effect on the deployed site in T6.

**Results:** 5 new tests in `test_render_static_headers.py`; full backend suite passes. `render` CLI not installed, so
`render blueprints validate` not run. HTML rule targets `/index.html` (rewritten SPA routes serve it; Render's default for
static HTML is already must-revalidate) - confirm with `curl -I` on `/` and a deep link in T6.

**Dependencies:** None (can run in parallel with T2-T4; `/fonts/*` is harmless before T4)
**Files likely touched:**
- `render.yaml`
- `backend/movie_csv/test_render_static_headers.py` (new)

**Estimated scope:** S

---

## Checkpoint B: After Tasks 4-5
- [ ] All frontend gates and the backend blueprint tests pass
- [ ] Review with human before deploying

---

## Task 6: After-measurement and decision

**Description:** Repeat the T1 measurements on the local build and the deployed URL,
fill in the table, and decide whether the target is met or bundle splitting becomes a
follow-up spec. Deploying means pushing the deploy branch, which needs your go-ahead first.

**Acceptance criteria:**
- [ ] First Paint < 1.5s, FCP < 1.8s, CLS < 0.1 (applied throttling) on the deployed URL, or the gap is documented
- [ ] `curl -I` confirms cache headers on a hashed asset and a font
- [ ] `SPEC-ttsr.md` open questions resolved or carried forward

**Verification:**
- [ ] Measurements table complete; before/after comparison written up

**Dependencies:** T1-T5
**Files likely touched:** `tasks/todo-ttsr.md`, `SPEC-ttsr.md`
**Estimated scope:** XS

---

## Measurements

Primary metric is observed **First Paint** (Lighthouse has no "Start Render"), measured with
`--throttling-method=devtools`. The first baseline rows below were *simulated* and are kept
for reference only; add applied-throttling rows next to them.

| Run | First Paint ("Start Render") | FCP | LCP | CLS |
|-----|--------------|-----|-----|-----|
| **Baseline, local dist (applied throttling, median of 5)** | **14367 ms** (14331-14484) | 14367 ms | 14367 ms | 0.01 |
| Baseline, local dist (applied throttling, other) | Speed Index 14682 ms, TBT 42 ms | | | |
| _Superseded:_ local dist (simulated, median of 5) | n/a (not reported) | 1709 ms (runs: 6268, 1705, 6928, 1698, 1709) | 1709 ms | 0.02 |
| _Superseded:_ local dist (observed first paint, simulated runs) | 2118, 2092, 2123, 3007, 3512 ms | same as first paint | same | 0.02 |
| _Superseded:_ local dist (other, simulated runs) | Speed Index 8450 ms, TBT 944 ms | | | |
| Baseline, deployed | | | | |
| After T2, local dist (applied throttling, median of 5) | **3103 ms** (3099-3106) | 3103 ms | 14642 ms | 0.01 |
| After T2, local dist (applied throttling, other) | Speed Index 12551 ms, TBT 979 ms | | | |
| After T2b, local dist (applied throttling, median of 5) | **1516 ms** (1417-1531) | 1516 ms | 11433 ms | 0.01 |
| After T2b, local dist (applied throttling, other) | Speed Index 9358 ms, TBT 603 ms | | | |
| After T3, local dist | | | | |
| After T4 (fonts self-hosted, one Fraunces-400 preload), local dist (applied, median of 5) | **1358 ms** (1352-1372) | 1358 ms | 12257 ms | **0.23** (4 of 5 runs; run 1 = 0 but never hydrated, LCP=FCP) |
| After T4, other | Speed Index 5525 ms, TBT 604 ms | | | |
| After T4 CLS cause | one shift of 0.227: `fraunces-500-v1.woff2` (home hero heading) loaded after first render. Fix: also preload Fraunces 500. Re-measure into `/tmp/lh-after-t4b`. | | | |
| After T4 + Fraunces-500 preload, local dist (applied, median of 5) | **1374 ms** (1362-1382) | 1374 ms | 12454 ms | **0.01** (all 5 runs) |
| After T4 + preload, other | Speed Index 5549 ms, TBT 597 ms | | | |
| After T5, local dist | | | | |
| After, deployed | | | | |
