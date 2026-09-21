# Spec: Mobile Bottom Nav — Home · Lists · Log (+) · Profile

> Separate from `SPEC.md` (the Render deployment spec), which this does not replace.
> Status: **DRAFT — awaiting approval.** No code written.

## Objective

Replace the mobile bottom tab bar's **Search** tab with a **Log (+)** action and add a
**Lists** tab, so the app's core verb (log an essay) is one tap from anywhere and saved
lists get first-class access.

**Users:** signed-in users on the native iOS/Android app (and the mobile-width Expo web
layout only where `Platform.OS !== 'web'` already gates the bar — web keeps `WebNav`).

**Decisions already made (from review):**
1. Tab order: **Home · Lists · Log (+) · Profile**.
2. The persistent top search bar (`MobileTopNav`) **stays as-is on all screens**.
3. **Log** opens the Search screen in "log mode" (search focused, hint text, result tap
   goes to `quickLog`), rather than a new picker modal.
4. **Settings** moves under Profile (no floating/tab entry).

**Current state (verified in code):**
- `components/ui/MobileNav.tsx` renders 3 hard-coded `NavItem`s: Home `/`, Search
  `/(tabs)/search`, Profile `/(tabs)/profile`. Active state is `pathname.includes(...)`.
- `components/ui/MobileTopNav.tsx` → `SearchField` is mounted in the root `app/_layout.tsx`
  for every screen; on focus/typing it `router.push`es or `setParams` on `/(tabs)/search`
  with `q` / `submittedAt`.
- `/(tabs)/lists` already exists (`ListsScreen`); Profile already links to it via a "Lists"
  `TabButton`.
- `SearchScreen` result tap currently goes to **`/logVideoModal`** (full review), not
  `quickLog`. **Nothing in the app currently navigates to `/quickLog`.**
- `quickLog` requires an `essayId` param; it cannot be opened without a selected essay.
- `app/(tabs)/settings.tsx` is an **empty stub** (comments only, no component) and nothing
  links to it. `components/ui/SignOutButton.tsx` exists.
- The blue gear in the reference screenshot is not rendered by app code (no gear/cog in
  `app/`, `src/`, `components/`); it is the Expo dev-client floating tools button and is
  dev-only. It is **not** something this spec fixes.

## Tech Stack

Unchanged. Expo SDK 54, React Native 0.81, expo-router 6, `@expo/vector-icons`
(`MaterialCommunityIcons`), `@rneui/themed` `SearchBar`, Clerk (`@clerk/clerk-expo`),
Jest (`jest-expo`) + `@testing-library/react-native`. **No new dependencies.**

## Commands (run from `frontend/`)

```
npx tsc --noEmit
npm run lint
npm test
npx jest components/ui/__tests__/MobileNav.test.tsx
npx jest -t "log mode"
npx expo export --platform web        # gate: web build must still succeed
npx expo start                        # manual check on iOS sim / Android emulator
```

## Behavior

### Tab bar
| Slot | Label | Icon | Action | Active when |
|---|---|---|---|---|
| 1 | Home | `home` | `router.push('/')` | pathname is `/` |
| 2 | Lists | `format-list-bulleted` | `/(tabs)/lists` | pathname includes `lists` |
| 3 | Log | `plus-circle` (larger, accent-filled) | `/(tabs)/search?mode=log&focus=<Date.now()>` | pathname includes `search` **and** `mode=log` |
| 4 | Profile | `account` | `/(tabs)/profile` | pathname includes `profile` |

- The Log button is visually emphasized (bigger icon, accent color) but stays inside the
  same row; it is a navigation action, not a modal-presenting FAB.
- Bar height/safe-area logic in `MobileNav` is unchanged.
- Shown only when `<SignedIn>` (unchanged).

### Log mode (Search screen)
- Entered via `mode=log` route param. `SearchScreen` reads it with `useLocalSearchParams`.
- In log mode: search input is focused on mount, empty-state copy reads
  "Search for the essay you want to log", and tapping a result (DB or YouTube-converted)
  navigates to `/quickLog?essayId=<public_id>` instead of `/logVideoModal`.
- Without `mode=log` (reached via the top search bar) behavior is **unchanged**:
  result tap still goes to `/logVideoModal`.
- Because the top bar's `pushQuery` calls `router.setParams({q,...})`, it must not drop
  `mode` when the user is already on the search route (merge, don't replace — verify
  `setParams` semantics; see Open Questions).

### Settings under Profile
- `ProfileScreen` gets a Settings entry (own-profile only, not `otherProfile`) that pushes
  `/(tabs)/settings`.
- `settings.tsx` becomes a real screen. **Minimum scope:** Sign out (reuse
  `SignOutButton`). Change password / delete account / photo stay out of scope
  (the stub's own note says Clerk's `UserButton`/hosted UI may cover them).

## Project Structure

```
components/ui/MobileNav.tsx           → 4 items; Log is the emphasized slot
components/ui/__tests__/MobileNav.test.tsx   → NEW
src/screens/SearchScreen.tsx          → read mode=log; retarget result press; focus input
src/screens/__tests__/SearchScreen.logMode.test.tsx → NEW
src/screens/ProfileScreen.tsx         → Settings entry
app/(tabs)/settings.tsx               → real screen (sign out)
app/(tabs)/_layout.tsx                → already registers lists; add settings Stack.Screen
components/ui/SearchField.tsx         → preserve `mode` param when updating params
```

No backend changes. No new routes other than making `settings` a real screen.

## Code Style

Match existing files: function components, `StyleSheet.create` at bottom, theme via
`Colors[useColorScheme() ?? 'light']`, fonts via `Fonts?.sansMedium`, route strings cast
`as any` in `NavItem` only where already done. Sketch:

```tsx
const isLog = pathname.includes('search') && mode === 'log'
<NavItem href="/(tabs)/lists" label="Lists" icon="format-list-bulleted"
  active={pathname.includes('lists')} theme={theme} />
<LogButton href={{ pathname: '/(tabs)/search', params: { mode: 'log', focus: String(Date.now()) } }}
  active={isLog} theme={theme} />
```

PascalCase components; no comments restating code; comment only the non-obvious
(e.g. why `mode` must survive `setParams`).

## Testing Strategy

The repo has almost no frontend coverage, and CLAUDE.md sets the gates as `tsc`, `lint`,
and `expo export --platform web`. This change adds **targeted** tests, not a broad suite:

- **MobileNav (unit, RNTL):** renders exactly Home, Lists, Log, Profile in that order; no
  Search item; Log has a distinct testID; correct item is active for each pathname
  (mock `usePathname`).
- **SearchScreen log mode (unit):** with `mode=log`, tapping a DB result calls
  `router.push` with `/quickLog` + `essayId`; without it, still `/logVideoModal`
  (regression guard for current behavior). YouTube-result path converts first, then
  routes the same way.
- **Manual (iOS sim + Android emulator):** full flow in Success Criteria; verify the
  bottom sheet in `quickLog` opens above the tab bar.

## Boundaries

- **Always:** run `tsc`, `lint`, jest, and `expo export --platform web` before committing;
  keep web nav (`WebNav`) unchanged; keep the backend URL only in `src/api/client.ts`;
  add a regression test for the unchanged non-log-mode search tap.
- **Ask first:** adding a dependency (e.g. a tab library); changing the top search bar's
  behavior; migrating to expo-router `Tabs`/`NativeTabs` (root layout imports
  `NativeTabs` but does not use it); touching the in-progress uncommitted files
  (`ListsScreen`, `ListsGrid`, `ProfileScreen`, `SearchScreen`, `WebNav`, `collectionInfo`).
- **Never:** edit applied migrations or backend for this change; remove the top search
  bar; hardcode hosts/keys; delete commented-out models per CLAUDE.md; commit the dev-only
  gear "fix" as if it were an app bug.

## Success Criteria

1. On iOS and Android, a signed-in user sees exactly: Home, Lists, Log (+), Profile.
2. Tapping Log lands on Search with the keyboard up; picking a result opens the
   `quickLog` sheet for that essay; submitting a rating creates a log
   (`createLog`), and it appears in Home "recently logged".
3. Using the top search bar (not Log) and tapping a result still opens
   `/logVideoModal` — unchanged.
4. Lists tab opens `ListsScreen`; active highlight is correct on every tab, and Log is
   highlighted only in log mode.
5. Profile → Settings opens a screen with working Sign out; Settings is not reachable
   from other users' profiles.
6. Signed-out users still see no bottom bar. Web output is unchanged.
7. `npx tsc --noEmit`, `npm run lint`, `npm test`, and `expo export --platform web` pass.

## Open Questions

1. **Search tab removal vs. de-facto log picker.** Today a Search-result tap already opens
   the full log modal, so the old Search tab effectively *was* the log picker. Confirm the
   intended split: top bar = "look up / view essay", Log = "quick log". If so, should the
   non-log result tap eventually go to `videoInfo` instead of `logVideoModal`? (Out of
   scope here; flagged.)
2. **`quickLog` has never been reachable.** It may have bit-rotted; expect to debug it
   (sheet over the tab bar, its swipe-up-to-`logVideoModal` handoff) during
   implementation. Budget for that.
3. **`router.setParams` semantics:** confirm it merges rather than replaces so `mode=log`
   survives typing. If it replaces, `SearchField` must re-send `mode` explicitly.
4. **Settings scope:** is Sign out alone enough for the beta, or do you want change
   profile picture / password now?
5. **Uncommitted work:** several files this touches have unstaged edits. Commit or stash
   first, or should this branch off them?
