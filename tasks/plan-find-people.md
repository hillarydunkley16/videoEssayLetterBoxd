# Implementation Plan: Search modes (Essays / People / Lists) + Find People

Spec: `SPEC-find-people.md` (v3, decisions recorded). Task list: `tasks/todo-find-people.md`.
Separate from the deploy plan (`tasks/plan.md`). Branch: `v2`.

## Overview

Add People and Lists modes to the shared search bar/screen, point "Find people to follow" at
People mode, and close the existing watchlist leaks so Lists search (and the rest of the API)
never exposes a watchlist. No schema change, no migration.

Baseline (T0) must be recorded before any change: `backend/.venv/bin/python manage.py test`,
`npx jest`, `npx tsc --noEmit`, `npm run lint`. Compare "no new errors" against it.

## Dependency graph

```
T1 people-search API ─────────────────────┐
T2 collection-privacy (leaks) ─┬─ T3 owner-only writes (needs OK, OQ7)
                               └─ T4 list-search API ─┐
                                                      │
T5 frontend API fns + UserRow extraction ─────────────┤
                                                      ▼
                                   T6 modes scaffold + People view + feed button
                                                      └─ T7 Lists view
                                                           └─ T8 mobile + full gates
```

T1 and T2 are independent; T3 is optional and independent of T4. T5 can start any time
(pure frontend, no dependency on backend being live — API fns are typed against the contract).

## Slicing

Backend modules are vertical-enough on their own (endpoint + tests, independently shippable).
Frontend is cut so each task leaves the app working: T5 is behavior-preserving, T6 delivers the
whole "Find people to follow" flow, T7 adds Lists.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fixing the leaks breaks an existing caller | Only two callers (`popularLists.tsx`, `collectionInfo.tsx`); tests first; own-watchlist detail must still 200 |
| Existing tests encoded the leak (`test_collection_owner`, `test_watchlist`) | Update only the assertions that depended on it; call it out in the commit |
| `SearchScreen` already juggles `q`, `submittedAt`, `mode=log`, debounce, request ids | Add `type` as one more param; keep essays path byte-for-byte; jest test that essays behavior is unchanged before touching it |
| `SearchField` shared with `MobileTopNav` | Only change placeholder + preserve `type`; verify mobile in T8 |
| `icontains` slow at scale | Fine for beta; `pg_trgm` index is a follow-up (ask first, migration) |
| Users without `display_username` unsearchable | Accepted for now; tracked follow-up |

## Verification checkpoints

- **Checkpoint A (after T4):** full backend suite green; `makemigrations --check` clean; manual
  `curl` of both endpoints as a signed-in user; watchlist absent from list + search.
- **Checkpoint B (after T7):** jest, `tsc`, lint, web export; manual on `expo start --web`.
- **Final (T8):** all spec success criteria; human review before PR.

## Deploy note

Backend first (new endpoints are additive; leak fixes are safe to ship alone), then frontend.
The frontend depends on both new endpoints, so do not ship T6/T7 ahead of T1/T4.
