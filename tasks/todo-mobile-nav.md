# Mobile Nav — Task List

Plan: `tasks/plan-mobile-nav.md`. Spec: `SPEC-mobile-nav.md`. Branch: `v2`.
All commands run from `frontend/`. Order matters: T1 → T2 → T3; T4 is independent.

---

## Task 0: Resolve uncommitted working tree  ✅ DONE (ec4042b)

**Description:** `v2` has unstaged edits in `ListsScreen`, `ListsGrid`, `ProfileScreen`,
`SearchScreen`, `WebNav`, `collectionInfo`, `(modals)/_layout`, plus untracked
`addEssayToList.tsx` and `AddEssayToListScreen.tsx`. Several of these are files T1/T3/T4
touch. Decide how to isolate them before editing.

**Acceptance criteria:**
- [ ] Working tree is clean, or the user has explicitly chosen to build on top of it
- [ ] Nothing in the in-progress add-essay-to-list work is lost

**Verification:**
- [ ] `git status --short` shows the agreed state

**Dependencies:** None (needs user decision: commit as WIP / stash / branch)
**Files likely touched:** none
**Estimated scope:** XS

---

## Task 1: Search log mode routes results to quickLog  ✅ DONE

**Description:** `SearchScreen` reads `mode=log`. In log mode it focuses the input, shows
"Search for the essay you want to log", and tapping a DB or YouTube-converted result
pushes `/quickLog?essayId=<public_id>`. Without `mode=log`, tap still goes to
`/logVideoModal`. `SearchField` must not drop `mode` when it updates params.

**Acceptance criteria:**
- [x] `/(tabs)/search?mode=log` shows the log-mode empty text and focuses the input
- [x] In log mode, DB result tap → `router.push` to `/quickLog` with `essayId`
- [x] In log mode, YouTube result tap converts, then routes to `/quickLog` with the new `essayId`
- [x] Without `mode`, result tap still goes to `/logVideoModal` (regression guard)
- [x] Typing in the top search bar while in log mode keeps `mode=log` (relies on `router.setParams` merging; confirm in T2 manual run)
- [x] `SearchField` takes focus when a `focus` param appears/changes (input lives in root layout, not the screen)

**Verification:**
- [x] `npx jest src/screens/__tests__/SearchScreen.logMode.test.tsx` passes
- [x] `npx tsc --noEmit` shows no new errors (baseline has pre-existing ones; compare)
- [ ] Manual: type in the top bar in log mode, confirm `mode` survives (`router.setParams` merge check) — NOT yet run; needs simulator (fold into T2/T5 manual pass)

**Dependencies:** T0
**Files likely touched:**
- `src/screens/SearchScreen.tsx`
- `components/ui/SearchField.tsx`
- `src/screens/__tests__/SearchScreen.logMode.test.tsx` (new)
- `components/ui/__tests__/SearchField.test.tsx` (new)

**Estimated scope:** Small (2 files + test)

---

## Task 2: Make quickLog work end-to-end  ⚠️ CODE DONE, MANUAL VERIFY + 2 DECISIONS PENDING

**Description:** `quickLog` has never had a caller. Drive it from T1's entry point and fix
whatever breaks: sheet opening above the tab bar, rating → `createLog`, the swipe-up handoff
to `logVideoModal`, and the return to Home. Debugging task; fix only what blocks the flow.

**Acceptance criteria:**
- [ ] From log mode, selecting an essay opens the `quickLog` sheet with that essay
- [x] Setting a rating and dismissing/confirming creates exactly one log (no duplicates) — fixed a real duplicate: close effect re-ran on every render because `useAuthPost()` returns a new fn each render; guarded with `closeHandledRef`. Covered by `app/(modals)/__tests__/quickLog.test.tsx` (RED was 3 calls, now 1)
- [ ] The new log appears under "recently logged" on Home
- [ ] ~~Swiping/expanding opens `logVideoModal`~~ — **spec was wrong**: `snapPoints` is only `['90%']`, so there is no expanded state. The real handoff is the sheet's "Add Review" button (`QuickLogScreen` → `/logVideoModal?essayId=`). See decisions below.

**Verification:**
- [ ] Manual on iOS simulator (and Android emulator if available), full flow
- [x] Existing `logVideoModal` test still passes (full suite: 8 suites / 47 tests)
- [x] `npx tsc --noEmit` (38 = baseline) / lint (0 errors)

**Dependencies:** T1
**Files likely touched:**
- `app/(modals)/quickLog.tsx`
- `src/screens/QuickLogScreen.tsx`
- `app/(modals)/_layout.tsx` (only if presentation options need changing)

**Estimated scope:** Medium (unknown until run; stop and re-plan if it exceeds ~5 files)

---

**Found while reading, NOT fixed (need a decision):**
1. ✅ FIXED (per approval, option: skip auto-save) — **Add Review can create two logs.** Rating in the sheet is saved when the sheet closes; "Add Review" pushes `logVideoModal`, which creates its own log. Rate then Add Review → two logs for one viewing. Now: Add Review `router.replace`s to `/logVideoModal?essayId&rating`, sets `closeHandledRef` so nothing auto-saves, and the modal starts from the passed rating. Tests in `quickLog.test.tsx` and `logVideoModal.test.tsx`.
2. ✅ FIXED (removed from the quick-log sheet) — **Heart button is broken.** `QuickLogScreen.handleLike` calls `likeLog(essayId)`, but the endpoint is `/api/logList/<log id>/like/` and no log exists yet.
3. Watch / Watchlist toggles are local-only; `rewatch` never reaches the parent payload (`onWatchedChange` is never called).

**Still needs a human (simulator + Clerk sign-in + backend):**
- [ ] From log mode, selecting an essay opens the sheet with that essay
- [ ] Rating + Done creates one log and it shows in Home "recently logged"
- [ ] Sheet sits correctly above the tab bar
- [ ] Typing in the top bar in log mode keeps `mode=log` (T1 `setParams` merge check)


---

## Checkpoint: Log flow
- [ ] Log flow works manually end to end
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`: no new failures
- [ ] Review with human before T3

---

## Task 3: MobileNav → Home · Lists · Log (+) · Profile

**Description:** Replace the Search item with Lists and an emphasized Log button that
navigates to `/(tabs)/search?mode=log&focus=<Date.now()>`. Active state: Lists on `lists`, Log on
`search` + `mode=log`, Home on `/`, Profile on `profile`. Bar height/safe-area and the
signed-in gating are unchanged.

**Acceptance criteria:**
- [ ] Bar shows exactly Home, Lists, Log, Profile in that order; no Search item
- [ ] Log is visually emphasized and uses a distinct testID
- [ ] Tapping Lists opens `ListsScreen`; tapping Log opens search in log mode
- [ ] Correct active highlight per route; Log active only in log mode
- [ ] Signed-out users see no bar; `WebNav` untouched

**Verification:**
- [ ] `npx jest components/ui/__tests__/MobileNav.test.tsx` passes (order, no Search, active states via mocked `usePathname`/params)
- [ ] `npx tsc --noEmit` / `npm run lint`: no new errors
- [ ] Manual: iOS sim tap through all four tabs

**Dependencies:** T1 (T2 for the flow to be usable)
**Files likely touched:**
- `components/ui/MobileNav.tsx`
- `components/ui/__tests__/MobileNav.test.tsx` (new)

**Estimated scope:** Small (1 file + test)

---

## Task 4: Real Settings screen with Sign out, linked from own Profile

**Description:** `app/(tabs)/settings.tsx` is a comments-only stub with no component and
no inbound link. Make it a screen with Sign out (reuse `components/ui/SignOutButton.tsx`),
register it in `(tabs)/_layout.tsx`, and add a Settings entry on the own-profile view only.

**Acceptance criteria:**
- [ ] Profile shows a Settings entry on your own profile, not on `otherProfile/[id]`
- [ ] Settings opens a screen with a working Sign out that returns to signed-out home
- [ ] `settings.tsx` has a default-exported component (no expo-router missing-export warning)

**Verification:**
- [ ] `npx tsc --noEmit` / `npm run lint`: no new errors
- [ ] Manual: Profile → Settings → Sign out
- [ ] `npx expo export --platform web` succeeds

**Dependencies:** T0 (touches `ProfileScreen`, which has unstaged edits). Independent of T1–T3.
**Files likely touched:**
- `app/(tabs)/settings.tsx`
- `app/(tabs)/_layout.tsx`
- `src/screens/ProfileScreen.tsx`

**Estimated scope:** Small (3 files)

---

## Task 5: Final gates and manual pass

**Description:** Run every gate and walk the full spec checklist on device/simulator.

**Acceptance criteria:**
- [ ] All 7 success criteria in `SPEC-mobile-nav.md` verified
- [ ] Top search bar → result tap still opens `/logVideoModal`
- [ ] No new `tsc`/lint errors vs. the pre-change baseline

**Verification:**
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npx expo export --platform web`
- [ ] Manual on iOS sim and Android emulator

**Dependencies:** T1–T4
**Files likely touched:** none (fixes only)
**Estimated scope:** XS

---

## Checkpoint: Complete
- [ ] All spec success criteria met
- [ ] Web build green, web nav unchanged
- [ ] Review with human; then commit per task (one commit each) and open PR to `main`
