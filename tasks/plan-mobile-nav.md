# Implementation Plan: Mobile Bottom Nav (Home · Lists · Log (+) · Profile)

Traces to `SPEC-mobile-nav.md`. Task list: `tasks/todo-mobile-nav.md`.
Separate from `tasks/plan.md` (deploy), which still has open items and is untouched.

## Overview

Swap the mobile Search tab for Lists + a Log (+) action, make Log open Search in
"log mode" (result tap → `quickLog`), and give Settings a real home under Profile.
Frontend only, no new dependencies, no backend changes.

## Dependency graph

```
T0 clean working tree (decision)
 │
 ├─ T1 log mode: SearchScreen + SearchField ──► T2 quickLog reachable end-to-end
 │                                                   │
 │                                                   ▼
 └────────────────────────────────────────────► T3 MobileNav 4 tabs (Log → log mode)
                                                     │
 T4 Settings screen + Profile link  (independent; can run parallel with T1–T3)
                                                     │
                                                     ▼
                                              T5 final gates + manual pass
```

## Architecture decisions

- **Log mode is a route param (`mode=log`), not new state or a new screen.** Matches how
  `SearchField` already drives `SearchScreen` (`q`, `submittedAt`) and reuses the existing
  result tiles and YouTube→DB conversion.
- **Risk first.** `quickLog` has no callers today and may be broken, so the slice that
  proves search → quickLog → `createLog` comes before the tab-bar UI. A pretty tab bar
  pointing at a broken flow is worse than none.
- **Tab bar stays a hand-rolled `MobileNav`.** No migration to expo-router `Tabs` /
  `NativeTabs` (spec: ask first).
- **Non-log search behavior is frozen** (`/logVideoModal`) and guarded by a test.

## Task list

### Phase 0: Prep
- [ ] T0: Resolve uncommitted working tree (needs your call)

### Phase 1: Log flow (highest risk)
- [ ] T1: Search log mode routes results to `quickLog`
- [ ] T2: Make `quickLog` work end-to-end (debug what T1 exposes)

### Checkpoint: Log flow
- [ ] Manually open `/(tabs)/search?mode=log`, pick an essay, rate it, log appears in Home feed
- [ ] `tsc`, `lint`, `npm test` pass; review with human

### Phase 2: Navigation
- [ ] T3: MobileNav → Home · Lists · Log(+) · Profile

### Phase 3: Settings (independent)
- [ ] T4: Real Settings screen with Sign out, linked from own Profile

### Checkpoint: Complete
- [ ] All `SPEC-mobile-nav.md` success criteria met
- [ ] `expo export --platform web` succeeds; web nav unchanged
- [ ] Review with human

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `quickLog` bit-rotted (never navigated to; bottom sheet may sit under the tab bar) | High | T1/T2 come first; T2 is explicitly a debugging task with its own budget |
| `router.setParams` replaces instead of merges → `mode` lost while typing | Med | Verify in T1; fallback is `SearchField` re-sending `mode` |
| Editing files with uncommitted work (`SearchScreen`, `ProfileScreen`) | Med | T0 first; keep diffs small so they stay separable |
| Active-tab highlight wrong (Search and Log share a route) | Low | Log active = `search` + `mode=log`; unit-tested in T3 |
| Log tab focus/keyboard flaky on Android | Low | Manual check in T5 on both platforms |

## Open questions (carried from spec)

1. Should non-log result tap eventually go to `videoInfo`? (Out of scope; unchanged here.)
2. Settings scope: Sign out only for now.
3. T0 decision: commit, stash, or branch off the in-progress work.
