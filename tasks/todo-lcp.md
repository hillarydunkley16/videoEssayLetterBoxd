# Task List: LCP (SPEC-lcp.md)

Plan: `tasks/plan-lcp.md`. Method: `bash frontend/scripts/lh-median.sh <url> /tmp/lh-<label> 5`
(fresh outdir, one run at a time, applied throttling, median of 5). Run one task per `/agent-skills:build`.
Gates every task: full jest, `npx tsc --noEmit`, `npm run lint` (0 errors), `npx expo export --platform web`.

## Phase 1: the hero stops waiting for Clerk

### [x] Task 1: Signed-out hero in the static HTML, shown before Clerk loads (risk-first) ✅ DONE (browser + Lighthouse checks pending)

**Description:** On web, the home route (`/`) renders the signed-out hero while Clerk is not loaded, both in the exported
HTML and in the client's first render, so hydration reuses the DOM. Other routes keep `WebShellSkeleton` until Clerk loads.

**Acceptance criteria:**
- [ ] `dist/index.html` contains the headline text ("Track every video essay that…") and the "Create account" button
- [ ] With Clerk not loaded on web: `/` renders the hero, any other route renders the skeleton (no `<Stack>` content)
- [ ] With Clerk loaded and signed out: hero stays; native behavior (`Platform.OS !== 'web'`) is unchanged
- [ ] The Fraunces weight used by the headline is preloaded (add a preload and update the `html.test.tsx` preload test if it isn't 400/500)
- [ ] Hero colors in dark mode are covered by the critical CSS (no light flash on the filmstrip)
- [ ] No hydration warnings in the browser console

**Verification:**
- [ ] RED then GREEN tests: `_layout.test.tsx` (web/loading/home vs other route), home route test with mocked Clerk (not loaded → hero)
- [ ] `grep -c "rewired" frontend/dist/index.html` > 0 after export
- [ ] Lighthouse median into `/tmp/lh-after-lcp-t1`: record LCP, First Paint, CLS in the Measurements table

**Results:** new `HeroGate` (`components/ui/HeroGate.tsx`): on web the signed-out hero shows while Clerk loads and until
signed in; native keeps SignedOut semantics. `_layout.tsx` renders `<Stack>` before Clerk loads only at `usePathname() === '/'`.
`(home)/index.tsx` uses `HeroGate` instead of `SignedOut`. 258 -> 259+ tests (HeroGate x5, layout x1, home x3, html dark hero text x1),
`tsc` clean, lint 0 errors. Export: `dist/index.html` has the hero text and no skeleton; `search.html`/`profile.html` still have the skeleton.
Headline is Fraunces 500, already preloaded (no new preload needed). Added dark-mode overrides for the hero's muted/teal/cobalt text
(the static HTML carries light colors until hydration). Primary button background (cobalt) is not recolored in dark: it is
readable and only differs from the dark accent until hydration.
**First measurement (`/tmp/lh-after-lcp-t1`):** LCP 12,454 -> 1,430 ms (target < 4s met), Speed Index 5.5s -> 2.9s. Two side effects:
- CLS 0.22: the hero now paints (~1.43s) just before the preloaded fraunces-500 arrives (~1.47s), so the headline swapped
  from Georgia to Fraunces and the page reflowed. Fix: `'Fraunces Fallback'` = `local('Georgia')` with size-adjust 107.5%,
  ascent 91%, descent 23.7% (measured with fontTools from Fraunces 500 and Georgia); added to the web display font stack.
  Georgia-only: platforms without Georgia fall through to the next serif and may still shift slightly.
- TBT 597 -> 1,054 ms: same JS work, but the TBT window starts at FCP, which moved from ~12s to ~1.4s, so the bundle
  parse/hydration now falls inside it. Not a regression in work done; Phase 2 (bundle) is what lowers it.
Still to check in the browser: no hydration warnings, hero visible with JS blocked, dark-mode filmstrip, Lighthouse median.

**Stop condition:** if hydration mismatches or Clerk cannot render the hero server-side, stop and report options; do not work around it silently.

**Dependencies:** none (builds on TTSR T2/T4)
**Files likely touched:** `app/_layout.tsx`, `app/(home)/index.tsx`, `app/+html.tsx` (preload), `app/__tests__/_layout.test.tsx`, `app/__tests__/html.test.tsx`, a new home-route test
**Estimated scope:** M

### [x] Task 2: Signed-in users still land on the feed; regression sweep ✅ DONE (manual browser checks pending)

**Description:** Once Clerk reports signed in, the hero is replaced by the feed; signed-out stays on the hero; no stale
fetches or flicker loops. Covers the "brief hero flash" the spec accepts.

**Acceptance criteria:**
- [x] Test: Clerk loaded + signed in → feed (and `UsernameGateBanner`) renders, hero does not
- [x] Test: Clerk not loaded → no authenticated API calls are made from the home route (no feed, banner or tabs mount)
- [ ] Manual (browser, backend running): signed-in home works, signed-out home works, sign-out returns to the hero
- [x] CLS < 0.1 (0.02, see Measurements); both color schemes on first paint still to eyeball

**Verification:**
- [ ] Gates above; Lighthouse median into `/tmp/lh-after-lcp-t2` recorded

**Results:** no production code change was needed: `SignedIn` already mounts nothing until Clerk is loaded and signed in, so the feed, banner and
their authenticated fetches wait for Clerk, and `HeroGate` hides the hero once `isSignedIn`. Added 3 tests in `(home)/__tests__/index.test.tsx`
(`home auth transitions`): nothing signed-in mounts while Clerk loads; loading -> signed in swaps hero for feed + banner; sign-out returns to the hero.
They passed on first run (characterization of T1 behavior, not RED). 262 -> 265 tests. Lighthouse unchanged from T1 (no code change): CLS 0.02.
Still manual (needs backend + Clerk): signed-in home, signed-out home, sign-out back to hero, and how long the hero flash lasts for a signed-in user.

**Dependencies:** Task 1
**Files likely touched:** `app/(home)/index.tsx`, `app/(home)/__tests__/…`
**Estimated scope:** S

---

## Checkpoint A: After Tasks 1-2
- [ ] All frontend gates pass
- [ ] LCP median < 4s, First Paint < 1.5s, FCP < 1.8s, CLS < 0.1 (local export)
- [ ] **Decision with you:** is Phase 2 still needed (TBT ~600 ms, signed-in users, 4 MB bundle), or is LCP done?

---

## Phase 2: reduce the cost behind the hero (only if Checkpoint A says so)

### [ ] Task 3: Bundle analysis (no behavior change)

**Description:** Find what is in the 4 MB (996 kB transferred) entry bundle and rank candidates by size and by whether the
home page needs them. Output is a written finding, not code.

**Acceptance criteria:**
- [ ] Top 15 modules by size, from a source-map explorer run through `npx` (no `package.json` change)
- [ ] Each candidate marked: needed on home / lazy-loadable, with estimated saving
- [ ] Findings and a recommended split list written into this file; Task 6 scoped from it

**Verification:** analysis reproducible from the commands recorded here.
**Dependencies:** Checkpoint A **Files:** `tasks/todo-lcp.md` **Scope:** XS

### [ ] Task 4: Icon font (562 kB TTF)

**Description:** Stop shipping `MaterialCommunityIcons.ttf` on web, or subset it. Inventory the icon names used (~14 files),
then render them as inline SVG on web (a web-only icon component) or ship a subset font. Pick the smaller, simpler one.

**Acceptance criteria:**
- [ ] Inventory of icon names used, recorded here
- [ ] Web no longer requests the 562 kB TTF (or it is a small subset); native unchanged
- [ ] Icons look the same (manual screenshot comparison on home, search, profile)
- [ ] Tests for the web icon component (renders the right glyph for each used name)

**Verification:** gates; Network tab shows no large icon font; Lighthouse median recorded.
**Dependencies:** Checkpoint A **Files likely touched:** a new `components/ui/Icon*.tsx`, call sites (~14), tests **Scope:** M (watch for L; split if > 5 files)

### [ ] Task 5: Clerk loading (measure first)

**Description:** The Clerk script chain is ~5 sequential requests (~121+91+49+44 kB). Measure what is controllable
(preconnect to the Clerk host, load order) before changing anything; change only if it helps and stays safe.

**Acceptance criteria:**
- [ ] Waterfall findings recorded (what is serialized, what the dev-key instance adds)
- [ ] Either a measured improvement (e.g. `<link rel="preconnect">` to the Clerk origin, derived from env, never hardcoded) or a documented "no change" with numbers
- [ ] No hardcoded Clerk issuer/keys/hosts in source

**Verification:** gates; Lighthouse median recorded; signed-in flow manually checked.
**Dependencies:** Checkpoint A **Files likely touched:** `app/+html.tsx`, its test **Scope:** S

### [ ] Task 6: Bundle splits (scoped from Task 3)

**Description:** Lazy-load the heaviest things the home page doesn't need, as listed by Task 3. Split into one commit per
module group. Placeholder until Task 3 produces the list.

**Acceptance criteria:**
- [ ] Each split has a before/after entry-bundle size and a Lighthouse median
- [ ] All routes still load (manual sweep of the main routes); no native changes
- [ ] Full jest + export pass after each split

**Dependencies:** Task 3 **Scope:** to be set after Task 3

---

## Checkpoint B: After Phase 2
- [ ] All gates pass; numbers in the table for each task
- [ ] Review with you before any deploy

---

## Task 7: Final measurement and decision

**Description:** Repeat the measurements on the local export and the deployed URL, fill the table, and write up
before/after. Deploying (pushing the deploy branch) needs your go-ahead first.

**Acceptance criteria:**
- [ ] LCP < 4s, First Paint < 1.5s, FCP < 1.8s, CLS < 0.1 on the deployed URL, or the gap documented
- [ ] `SPEC-lcp.md` open questions resolved or carried forward
- [ ] Re-measure after the Clerk production cutover (carried forward if it hasn't happened)

**Dependencies:** Checkpoint A (and B if Phase 2 was done) **Files:** `tasks/todo-lcp.md`, `SPEC-lcp.md` **Scope:** XS

---

## Measurements (applied throttling, median of 5)

| Build | LCP | First Paint | FCP | TBT | CLS |
|---|---|---|---|---|---|
| Baseline = TTSR After-T4 + Fraunces-500 preload, local dist | 12,454 ms | 1,374 ms | 1,374 ms | 597 ms | 0.01 |
| After T1 (hero in HTML), local dist | **1,430 ms** (1424-1430) | 1,430 ms | 1,430 ms | 1,054 ms | **0.22** (all 5) |
| After T1 + Fraunces fallback metrics, local dist (build 18:35Z, run 18:38Z) | 1,425 ms | 1,425 ms | 1,425 ms | 1,110 ms | **0.24** (all 5): fallback did not fix it |
| _Diagnosis_ | filmstrip: headline is 2 lines at first paint, 3 lines after the swap; "Track every video essay that" is ~13.7em in Fraunces 500 (~383px at 28px, container 372px) vs 12.6em in Georgia (~353px). With a working 107.5% fallback it would already wrap. Console check: `'Fraunces Fallback'` measured 319px (Georgia 346, Fraunces 376), so it was not behaving as sized. Replaced by inlining the Fraunces 500 ASCII subset (11.6 kB woff2, 15.4 kB base64) in the HTML so no swap happens for the headline; the fallback face, its theme.ts stack entry and the 500 preload were removed. | | | | |
| After T1 + inlined Fraunces 500, local dist | 1,452 ms | 1,452 ms | 1,452 ms | 1,091 ms | **0.22** (all 5) |
| _Diagnosis 2_ | DevTools trace (4x CPU, Slow 4G): worst shift cluster at ~1.0s, culprit "Web font"; console `document.fonts`: Fraunces 500 inline `loaded`, Inter 400/600 `loaded` late. Inter's body text swaps from the system font after first paint and re-wraps the cards. Fix: Inter faces `font-display: optional`. | | | | |
| After T1 + Inter optional, local dist | 1,462 ms | 1,462 ms | 1,462 ms | 1,094 ms | **0.22** (all 5): fonts were not the cause |
| _Diagnosis 3_ | CLS identical to the previous run, so font swapping is ruled out. `createIconSet` renders an empty `<Text/>` until the icon font loads (~12s), so the 3 feature cards are ~34px shorter in the static HTML than once hydrated, and the closing section jumps. Fix: fixed 24x24 slot around each icon. | | | | |
| After T1 + icon slot, local dist (`/tmp/lh-after-lcp-t1e`) | 1,453 ms | 1,453 ms | 1,453 ms | 1,117 ms | **0.23** (all 5): icon slot was not the cause either |
| _Diagnosis 4_ | Trace from a Lighthouse run with `--save-assets`: one LayoutShift at 1,453 ms (= first paint), score 0.232; everything below the headline moves down exactly 34px (one line) - the headline paints in the fallback font for one frame, then the inlined Fraunces 500 arrives. Fix: the inlined face uses `font-display: block`. | | | | |
| After T1 + inline Fraunces 500 `block`, local dist (3 runs) | 1,462 ms | 1,454 ms | 1,454 ms | 1,089 ms | **0.02** (all 3) |
| After T2, local dist | | | | | |
| After T4 (icon font), local dist | | | | | |
| After T5 (Clerk), local dist | | | | | |
| After T6 (splits), local dist | | | | | |
| Final, deployed | | | | | |

## Notes
- Baseline facts (from `/tmp/lh-after-t4b`): LCP element is the hero `<h1>`; render delay ≈ all of LCP; entry bundle
  996 kB transferred, done ≈7s; icon TTF 562 kB, done ≈17s; Clerk chain done ≈15s (dev keys).
