# Implementation Plan: Edit & Delete Your Own Logs

Traces to `SPEC-log-edit-delete.md`. Tasks: `tasks/todo-log-edit-delete.md`.

## Overview
The log page (`logInfo.tsx`) gets an owner-only three-dots menu (Edit / Delete). Edit reopens
`logVideoModal` pre-filled and PATCHes; Delete confirms, calls the existing delete endpoint and
goes back. Backend ownership enforcement already exists; the only backend change is making
`essay` immutable on update.

## Architecture Decisions
- **Reuse `logVideoModal` for edit** via a `logId` route param (vs. `essayId` for create). In edit mode it
  fetches the log (`fetchALog`), seeds rating/review/date/rewatch, hides nothing else, and submits with
  `updateLog` (PATCH). Keeps one form; no duplicate UI.
- **No new endpoint.** `PATCH /api/logList/<uuid>/` (`logDetail`) is used for edit; existing `deleteLog()` for delete.
- **Essay immutability in the serializer** (`LogSerializer.update` drops `essay`), so create still requires it.
  Client always sends PATCH (never PUT), so no required-field issue.
- **Page refresh after edit:** `logInfo` reloads the log when the screen regains focus (edit modal closes with `router.back()`).
- **One shared popover** component for the three-dots menu, identical on web/iOS/Android; no `ActionSheetIOS`.
- **Delete confirm** follows Profile's existing pattern (Alert.alert does not work on web — check what Profile uses and reuse).

## Dependency Graph
```
Backend: essay immutable on PATCH (T1)
   └── Client updateLog + logVideoModal edit mode (T2)
           └── logInfo three-dots menu: Edit → modal, Delete → confirm (T3)
                   └── Verification pass across web/iOS/Android (T4)
```

## Task List
- [ ] T1: Backend — owner PATCH works, essay ignored, non-owner 403
- [ ] T2: Frontend — `updateLog` + `logVideoModal` edit mode (prefill, PATCH, no double submit)
### Checkpoint: Edit path works end-to-end via a manual deep link `/logVideoModal?logId=…`
- [ ] T3: Frontend — three-dots menu on log page (owner-only), Edit + Delete w/ confirm, refresh on focus
- [ ] T4: Gates + manual verification on web, iOS sim, Android
### Checkpoint: Complete — all spec acceptance criteria met

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Web date input uses `new Date('YYYY-MM-DD')` (UTC) and the modal serializes with `toISOString()`; prefilled date may shift a day in some timezones | Med | Parse the stored date as local (`new Date(y, m-1, d)`) when prefilling; add a test |
| Edit modal's `router.replace('/')` after save (create behavior) would be wrong for edit | Med | Branch on `logId`: edit → `router.back()`, create unchanged; test both |
| `logInfo` has stale data after edit | Med | Refetch on focus (`useFocusEffect`) |
| Web popover clipped/behind ScrollView | Low | Render menu absolutely positioned in the header row with a backdrop press-to-close; check on web |
| Existing create-flow regression (quickLog → logVideoModal, Prove-It test) | High | Keep `logVideoModal.test.tsx` green; edit branch is additive |

## Open Questions
None.
