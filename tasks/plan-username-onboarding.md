# Implementation Plan: Username Onboarding

Spec: `SPEC-username-onboarding.md`. Task list: `tasks/todo-username-onboarding.md`. Branch `v2`.
(Separate from `tasks/plan.md` / `tasks/todo.md`, which hold the still-open deploy-to-closed-beta
work — Task 13 in progress there. Do not touch those files for this plan.)

## Overview

Make the existing sign-up username field live-checked (availability + suggestions, debounced,
inline, no new page) and close the "existing users with no username are invisible to People
search" gap with a soft, dismissible nudge on the home feed and profile tab. Three vertical
slices: sign-up check, existing-user nudge, and confirming the already-built prod backfill has
run.

## Architecture Decisions

- **New `has_username: bool` on `ProfileSerializer`.** Found while reading `serializers.py`
  during planning, not in the original spec's Project Structure list: `display_username(user)`
  (the shared helper) and `ProfileSerializer.get_user`/`UserSerializer.get_username` already
  collapse a null `Profile.display_username` into the literal string `"Anonymous"` before it
  reaches the frontend. There is currently no way for the frontend to tell "no username set" apart
  from "a real user named Anonymous." `has_username` (`bool(profile.display_username)`) is added
  alongside the existing fields so `UsernameGateBanner` has something reliable to gate on. This is
  required to build spec decision 4 as written, not new scope — flagged here because it wasn't
  anticipated at spec time.
- **Availability endpoint follows the `UserSearch` pattern** (`movie_csv/views/api.py`): same
  `icontains`/`istartswith` style against `Profile.display_username`, `AllowAny` instead of
  `IsAuthenticated` (no Clerk session exists yet at this point in sign-up — see spec decision 2/3).
- **Frontend availability call uses the public-fetch pattern already in the codebase**
  (`fetchPopularVideoEssaysPublic` in `videos.ts` — plain `axios.get` against `API_BASE_URL`, no
  token), not `authFetch`, since the endpoint is public.
- **Debounce reuses the existing pattern** in `PeopleResults.tsx`/`ListResults.tsx`: a `setTimeout`
  plus a `generation` ref to drop stale responses. No new debounce mechanism.
- **`UsernameGateBanner` is self-contained.** It calls the existing `fetchProfile` itself (same
  call `ProfileScreen` already makes) and reads `has_username`; the two screens that mount it
  (`(home)/index.tsx`, `(tabs)/profile.tsx`) pass it no props and do no extra data-fetching wiring.
  Dismiss is local component state — no storage, per spec decision 4.

## Dependency graph

```
T1 has_username on ProfileSerializer ──────────────┬── T5 UsernameGateBanner ── T6 mount in home + profile tab
                                                     │
T2 UsernameAvailability endpoint + suggestions ──── T3 checkUsernameAvailability (frontend) ── T4 wire into sign-up.tsx

T7 confirm/schedule prod backfill run — independent, can happen any time
```

T1 and T2 have no dependency on each other and can be built in either order. T5/T6 (existing-user
nudge) and T3/T4 (sign-up check) are independent vertical slices once their backend half lands.

## Baseline (recorded before starting, 2026-09-22, branch `v2`)

| Gate | Result |
|---|---|
| `manage.py test` | 278 tests, OK |
| `makemigrations --check` | No changes detected |
| `npx jest` | 21 suites, 144 tests passed |
| `npx tsc --noEmit` | 38 errors (pre-existing) |
| `npm run lint` | 205 problems: 3 errors, 202 warnings (pre-existing) |

"No new errors" below means: tsc stays at 38, lint errors stay at 3, tests only go up.

## Task List

Tasks recorded in `tasks/todo-username-onboarding.md`.

| # | Title | Depends on | Scope |
|---|---|---|---|
| T0 | Baseline (this table) | None | XS |
| T1 | `has_username` on `ProfileSerializer` | None | XS |
| T2 | `UsernameAvailability` endpoint + suggestion generator | None | S |
| T3 | `checkUsernameAvailability` frontend API function | T2 | XS |
| T4 | Wire live check + suggestions + submit gate into `sign-up.tsx` | T3 | M |
| T5 | `UsernameGateBanner` component | T1 | S |
| T6 | Mount banner in home feed + profile tab | T5 | XS |
| T7 | Confirm/schedule `backfill_display_usernames` prod run | None | XS (operator) |
| T8 | Full gates sweep + close spec success criteria | T4, T6, T7 | S |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Our DB says a username is available but Clerk rejects it at `signUp.create()` (format rule we don't replicate, or a race). | Low | Already handled by existing `getClerkErrorMessage` catch path (spec decision 2/success criteria); T4's tests include this case explicitly rather than assuming it away. |
| `has_username` accidentally leaks something sensitive about other users. | Low | It's a boolean derived from public-ish profile data already shown elsewhere (usernames are public); no new sensitive surface. Confirmed in T1's tests. |
| Suggestion generator produces a suggestion that's itself taken (race between generation and the user reading it). | Low | T2 tests assert every returned suggestion is independently available at generation time; T4 doesn't need to re-check before offering it — final authority is still Clerk on submit. |
| Banner shows on `(home)/index.tsx` for signed-out users or flashes before `fetchProfile` resolves. | Low | `UsernameGateBanner` only renders inside `<SignedIn>` (home already has this wrapper) and while its own fetch is in flight, renders nothing (same "loading → then decide" pattern `ProfileScreen` already uses). |

## Open Questions

None — spec is fully resolved (`SPEC-username-onboarding.md`, all four open questions closed).
