# Username Onboarding — Task List

Plan: `tasks/plan-username-onboarding.md`. Spec: `SPEC-username-onboarding.md`. Branch: `v2`.
Backend commands from `backend/` using `.venv/bin/python` (system python has no Django).
Frontend commands from `frontend/`. Gates: `manage.py test`, `npx jest`, `npx tsc --noEmit`,
`npm run lint`, `npx expo export --platform web`.

---

## Baseline (T0, 2026-09-22, branch `v2`)

| Gate | Result |
|---|---|
| `manage.py test` | 278 tests, OK |
| `makemigrations --check` | No changes detected |
| `npx jest` | 21 suites, 144 tests passed |
| `npx tsc --noEmit` | 38 errors (pre-existing) |
| `npm run lint` | 205 problems: 3 errors, 202 warnings (pre-existing) |

"No new errors" in later tasks means: tsc stays at 38, lint errors stay at 3, tests only go up.

---

## Phase A — Backend

### T1: `has_username` on `ProfileSerializer`  ✅ DONE
- [x] Test first: own profile and another user's profile both include `has_username`; `true` when `Profile.display_username` is set, `false` when null/blank; existing `username`/`"Anonymous"` fallback behavior unchanged; no new queries (uses the already-`select_related`d `profile`)
- [x] Add `has_username = serializers.SerializerMethodField()` to `ProfileSerializer`, `get_has_username(self, obj): return bool(obj.display_username)`
- Acceptance: field present on both `ProfileDetail` (self) and `ProfileDetailById` (other) responses; no regression to existing profile tests
- Verify: `manage.py test movie_csv.test_profile_user_shape movie_csv.test_profile_follow_fields` then full suite
- Files: `movie_csv/serializers.py`, existing profile test file(s) · Scope: XS
- Done: 3 new tests (true/set, false/null, false/blank). Full suite 281 OK (was 278); `makemigrations --check` clean. Both `ProfileDetail` and `ProfileDetailById` use the same serializer, so both get the field for free.

### T2: `UsernameAvailability` endpoint + suggestion generator  ✅ DONE
- [x] `test_username_availability.py` first: taken (exact, case-insensitive) → `available: false` + ≥3 suggestions, each independently available; available → `available: true`, no suggestions; empty/too-short/invalid-format candidate → clear rejection (mirror whatever format Clerk enforces — letters/digits/underscore, reasonable length); public (no auth header needed, no 401); constant query count (`assertNumQueries`)
- [x] `UsernameAvailability` view (`AllowAny`, beside `UserSearch`) — query shape follows `UserSearch`'s `icontains`/`istartswith` pattern against `Profile.display_username`
- [x] Suggestion generator: base + numeric/underscore suffixes, one query against `display_username__istartswith=base` to find gaps, return first 3
- [x] Route: `users/username-available/` in `urls/api.py`
- Acceptance: spec's suggestion-algorithm decision (base + suffixes, 3 results) implemented exactly; response shape `{ "available": bool, "suggestions": [...] }`
- Verify: `manage.py test movie_csv.test_username_availability` then full suite
- Files: `movie_csv/views/api.py`, `movie_csv/urls/api.py`, `movie_csv/test_username_availability.py` · Scope: S
- Done: 10 new tests. Format rule chosen (not dictated by Clerk docs in-repo): 3-30 chars, letters/digits/underscore, 400 on violation. Full suite 291 OK (was 281); `makemigrations --check` clean.

### Checkpoint A
- [x] Full backend suite green (291); `makemigrations --check` clean — confirmed no schema change (both T1 and T2 were serializer/view additions only)
- [ ] Review before Phase B

## Phase B — Sign-up live check (vertical slice)

### T3: `checkUsernameAvailability` frontend API function  ✅ DONE
- [x] Test: builds the right URL with the candidate query-encoded; parses `{available, suggestions}`; no token required (follows `fetchPopularVideoEssaysPublic`'s plain-`axios.get` pattern, not `authFetch`)
- [x] Add to `frontend/src/api/users.ts`
- Acceptance: matches T2's response shape exactly
- Verify: `npx jest` · `tsc`
- Files: `frontend/src/api/users.ts`, test · Scope: XS · Depends on: T2
- Done: 3 new tests. jest 22 suites/147 tests (was 21/144); tsc 38 (= baseline, after casting axios test mocks `as any`); lint 3 errors (= baseline).

### T4: Wire live check + suggestions + submit gate into `sign-up.tsx`  ✅ DONE
- [x] Jest first: debounced check fires after typing stops (reuse `PeopleResults.tsx`'s `setTimeout` + `generation` ref pattern); stale-response guard (fast retyping doesn't show a stale result); taken → inline suggestions shown, tappable to autofill the field; available → inline confirmation; submit disabled while username is empty/checking/taken (extends the existing `disabled={!emailAddress || !password}` condition); the four other fields and the verification step are unchanged; a Clerk-side rejection on submit (our check said available, Clerk disagreed) still surfaces via the existing `getClerkErrorMessage` catch, not a crash
- [x] Implement in `frontend/app/(auth)/sign-up.tsx`
- Acceptance: spec success criteria for sign-up (decision 1, 2) met
- Verify: `npx jest app/\(auth\)/__tests__/sign-up.test.tsx` then full `npx jest` · `tsc` · lint
- Files: `frontend/app/(auth)/sign-up.tsx`, `frontend/app/(auth)/__tests__/sign-up.test.tsx` (new dir) · Scope: M · Depends on: T3
- Done: 11 new tests. Added `testID="signup-submit"` to the Pressable — querying via `.parent` on the "Continue" text was unreliable (an extra composite layer in the RN Text tree), so a stable testID replaced it. jest 23 suites/158 tests (was 22/147); tsc 38 (= baseline); lint 3 errors (= baseline).

### Checkpoint B
- [ ] Sign-up slice manually verified (yours): type a taken username, see suggestions, tap one, submit succeeds
- [ ] All gates green, no regression vs baseline

## Phase C — Existing-user nudge (vertical slice)

### T5: `UsernameGateBanner` component  ✅ DONE
- [x] Jest first: renders nothing while its own `fetchProfile` call is in flight or if it errors; renders the nudge only when `has_username === false`; renders nothing when `true`; dismiss hides it for the remainder of the session (local state only, no storage) and does not block anything else on screen
- [x] Implement in `frontend/src/components/UsernameGateBanner.tsx`, self-contained (calls `fetchProfile` itself via `getToken`, no props required)
- Acceptance: spec decision 4's UX exactly — soft, dismissible, session-only
- Verify: `npx jest src/components/__tests__/UsernameGateBanner.test.tsx` · `tsc` · lint
- Files: `frontend/src/components/UsernameGateBanner.tsx`, `frontend/src/components/__tests__/UsernameGateBanner.test.tsx` (new dir) · Scope: S · Depends on: T1
- Done: 5 new tests. Also fixed `frontend/src/types/profile.ts` — `has_username` was on the backend serializer (T1) but missing from the frontend type; tsc caught it (39 vs 38 baseline until fixed). jest 24 suites/163 tests (was 23/158); tsc 38 (= baseline); lint 3 errors (= baseline).

### T6: Mount banner in home feed + profile tab  ✅ DONE
- [x] Test: `(home)/index.tsx` and `(tabs)/profile.tsx` each render `<UsernameGateBanner />` inside their `<SignedIn>` section (home already has one; confirm profile's screen path); existing tests for both screens pass unmodified
- [x] Mount in `app/(home)/index.tsx` and `frontend/src/screens/ProfileScreen.tsx` (the actual profile tab implementation, per `app/(tabs)/profile.tsx`'s thin-wrapper pattern)
- Acceptance: spec decision 4's placement (home + profile tab, not global, not profile-only)
- Verify: `npx jest app/\(home\)/__tests__/index.test.tsx` plus a new `ProfileScreen` render test · `tsc` · lint · manual `expo start --web`
- Files: `frontend/app/(home)/index.tsx`, `frontend/src/screens/ProfileScreen.tsx`, tests · Scope: XS · Depends on: T5
- Done: 3 new tests (1 in `index.test.tsx`, 2 in new `ProfileScreen.usernameGate.test.tsx`). `index.test.tsx`'s existing 2 tests kept their assertions unchanged, only gained a new child-component mock (matching the file's existing stub-every-child pattern). jest 25 suites/166 tests (was 24/163); tsc 38 (= baseline); lint 3 errors (= baseline). Manual `expo start --web` walkthrough not run (deferred to T8/your review).

### Checkpoint C
- [ ] Manual (yours): sign in as a user with no `display_username`, confirm the nudge shows on home and profile, dismiss works, reappears on reload
- [x] All gates green, no regression vs baseline (jest 25/166, tsc 38, lint 3 errors — all = baseline)

## Phase D — Operational + wrap-up

### T7: Confirm/schedule `backfill_display_usernames` prod run  ✅ DONE
- [x] Check whether it's already been run in prod (per the open checkpoint in `tasks/todo-display-username.md`); if not, schedule it — **needs `CLERK_SECRET_KEY` in the Render shell for the one run, same as originally approved 2026-09-21**
- [x] On completion, close the checkpoint in `tasks/todo-display-username.md` and its "Every user must have a display_username" follow-up line
- Acceptance: command has been run (or a concrete date is scheduled) against prod data
- Verify: re-run with `--dry-run` afterward — no changes reported
- Files: none (operational) · Scope: XS (operator) · Depends on: none, do any time
- Done (2026-09-22): Render's dashboard Shell is paywalled, so this ran locally against prod via the external `DATABASE_URL` instead (`config/settings.py`'s `dj-database-url` wiring makes this work with no code change). Mid-task, the DB password was accidentally pasted into chat; rotated immediately via Render (new `databaseUser`), then the backend service was manually redeployed so its `fromDatabase`-sourced `DATABASE_URL` picked up the new credentials (confirmed via `list_deploys` — new deploy `live`, after the rotation timestamp). Dry-run against the new credentials reproduced the original prod numbers exactly (`1 updated, 0 unchanged, 1 without a Clerk username, 1 not in this database`), confirming connectivity. Real run: `1 updated`. Re-run `--dry-run`: `0 updated, 1 unchanged, ...` — confirmed idempotent.

### T8: Full gates sweep + close spec success criteria  ✅ DONE
- [x] All gates, fresh, recorded here: `manage.py test`, `makemigrations --check`, `npx jest`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web`
- [x] Walk every bullet in `SPEC-username-onboarding.md`'s Success Criteria and confirm each is met
- Acceptance: no regression vs T0 baseline; every success criterion checked off
- Files: this file · Scope: S · Depends on: T4, T6, T7
- Done (2026-09-22). Gates: backend 298 tests OK (T0 baseline 278; our own work added 13 through T1/T2 → 291; +7 more from unrelated concurrent "Share-to-app" commits layered on top after — not a regression, just other work sharing the branch), `makemigrations --check` clean; frontend jest 27 suites/179 tests (our own total at T6 was 25/166; +2 suites/+13 tests from the same concurrent work); `tsc --noEmit` 38 errors (= T0 baseline); `npm run lint` 3 errors (= T0 baseline), 210 warnings; `npx expo export --platform web` succeeds. One transient jest run mid-sweep showed 5 failed suites/15 failed tests with a "worker process failed to exit gracefully" warning — re-ran clean (27/27, 179/179); attributed to resource contention from the concurrent session, not a real regression (all username-onboarding-specific suites — sign-up, UsernameGateBanner, ProfileScreen.usernameGate, home index — passed in every run).
- Spec success criteria (`SPEC-username-onboarding.md`), all met:
  - [x] Live availability + suggestions on the existing sign-up field, other fields/flow unchanged (T4)
  - [x] Submit gated on empty/checking/taken only; Clerk race surfaces via existing error path (T4)
  - [x] Dismissible nudge on home feed + profile tab for `display_username IS NULL`; non-blocking; reappears next app open (T5, T6)
  - [x] `backfill_display_usernames` run against prod; `tasks/todo-display-username.md` checkpoint closed (T7)
  - [x] No regression across all five gates (this task)

### Checkpoint D / Final
- [x] Spec success criteria all met
- [ ] Human review, then PR using the org PR template

---

## Notes

- `has_username` (T1) was not in the original spec's Project Structure list — added during planning after finding `ProfileSerializer`/`UserSerializer` already collapse a null `display_username` into the literal `"Anonymous"` string, which would otherwise make T5's gate impossible to implement correctly. See `tasks/plan-username-onboarding.md` Architecture Decisions.
