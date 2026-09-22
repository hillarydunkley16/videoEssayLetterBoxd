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

### T1: `has_username` on `ProfileSerializer`
- [ ] Test first: own profile and another user's profile both include `has_username`; `true` when `Profile.display_username` is set, `false` when null/blank; existing `username`/`"Anonymous"` fallback behavior unchanged; no new queries (uses the already-`select_related`d `profile`)
- [ ] Add `has_username = serializers.SerializerMethodField()` to `ProfileSerializer`, `get_has_username(self, obj): return bool(obj.display_username)`
- Acceptance: field present on both `ProfileDetail` (self) and `ProfileDetailById` (other) responses; no regression to existing profile tests
- Verify: `manage.py test movie_csv.test_profile_user_shape movie_csv.test_profile_follow_fields` then full suite
- Files: `movie_csv/serializers.py`, existing profile test file(s) · Scope: XS

### T2: `UsernameAvailability` endpoint + suggestion generator
- [ ] `test_username_availability.py` first: taken (exact, case-insensitive) → `available: false` + ≥3 suggestions, each independently available; available → `available: true`, no suggestions; empty/too-short/invalid-format candidate → clear rejection (mirror whatever format Clerk enforces — letters/digits/underscore, reasonable length); public (no auth header needed, no 401); constant query count (`assertNumQueries`)
- [ ] `UsernameAvailability` view (`AllowAny`, beside `UserSearch`) — query shape follows `UserSearch`'s `icontains`/`istartswith` pattern against `Profile.display_username`
- [ ] Suggestion generator: base + numeric/underscore suffixes, one query against `display_username__istartswith=base` to find gaps, return first 3
- [ ] Route: `users/username-available/` in `urls/api.py`
- Acceptance: spec's suggestion-algorithm decision (base + suffixes, 3 results) implemented exactly; response shape `{ "available": bool, "suggestions": [...] }`
- Verify: `manage.py test movie_csv.test_username_availability` then full suite
- Files: `movie_csv/views/api.py`, `movie_csv/urls/api.py`, `movie_csv/test_username_availability.py` · Scope: S

### Checkpoint A
- [ ] Full backend suite green; `makemigrations --check` clean (no schema change expected — confirm)
- [ ] Review before Phase B

## Phase B — Sign-up live check (vertical slice)

### T3: `checkUsernameAvailability` frontend API function
- [ ] Test: builds the right URL with the candidate query-encoded; parses `{available, suggestions}`; no token required (follows `fetchPopularVideoEssaysPublic`'s plain-`axios.get` pattern, not `authFetch`)
- [ ] Add to `frontend/src/api/users.ts`
- Acceptance: matches T2's response shape exactly
- Verify: `npx jest` · `tsc`
- Files: `frontend/src/api/users.ts`, test · Scope: XS · Depends on: T2

### T4: Wire live check + suggestions + submit gate into `sign-up.tsx`
- [ ] Jest first: debounced check fires after typing stops (reuse `PeopleResults.tsx`'s `setTimeout` + `generation` ref pattern); stale-response guard (fast retyping doesn't show a stale result); taken → inline suggestions shown, tappable to autofill the field; available → inline confirmation; submit disabled while username is empty/checking/taken (extends the existing `disabled={!emailAddress || !password}` condition); the four other fields and the verification step are unchanged; a Clerk-side rejection on submit (our check said available, Clerk disagreed) still surfaces via the existing `getClerkErrorMessage` catch, not a crash
- [ ] Implement in `frontend/app/(auth)/sign-up.tsx`
- Acceptance: spec success criteria for sign-up (decision 1, 2) met
- Verify: `npx jest app/\(auth\)/__tests__/sign-up.test.tsx` then full `npx jest` · `tsc` · lint
- Files: `frontend/app/(auth)/sign-up.tsx`, `frontend/app/(auth)/__tests__/sign-up.test.tsx` (new dir) · Scope: M · Depends on: T3

### Checkpoint B
- [ ] Sign-up slice manually verified (yours): type a taken username, see suggestions, tap one, submit succeeds
- [ ] All gates green, no regression vs baseline

## Phase C — Existing-user nudge (vertical slice)

### T5: `UsernameGateBanner` component
- [ ] Jest first: renders nothing while its own `fetchProfile` call is in flight or if it errors; renders the nudge only when `has_username === false`; renders nothing when `true`; dismiss hides it for the remainder of the session (local state only, no storage) and does not block anything else on screen
- [ ] Implement in `frontend/src/components/UsernameGateBanner.tsx`, self-contained (calls `fetchProfile` itself via `getToken`, no props required)
- Acceptance: spec decision 4's UX exactly — soft, dismissible, session-only
- Verify: `npx jest src/components/__tests__/UsernameGateBanner.test.tsx` · `tsc` · lint
- Files: `frontend/src/components/UsernameGateBanner.tsx`, `frontend/src/components/__tests__/UsernameGateBanner.test.tsx` (new dir) · Scope: S · Depends on: T1

### T6: Mount banner in home feed + profile tab
- [ ] Test: `(home)/index.tsx` and `(tabs)/profile.tsx` each render `<UsernameGateBanner />` inside their `<SignedIn>` section (home already has one; confirm profile's screen path); existing tests for both screens pass unmodified
- [ ] Mount in `app/(home)/index.tsx` and `frontend/src/screens/ProfileScreen.tsx` (the actual profile tab implementation, per `app/(tabs)/profile.tsx`'s thin-wrapper pattern)
- Acceptance: spec decision 4's placement (home + profile tab, not global, not profile-only)
- Verify: `npx jest app/\(home\)/__tests__/index.test.tsx` plus a new `ProfileScreen` render test · `tsc` · lint · manual `expo start --web`
- Files: `frontend/app/(home)/index.tsx`, `frontend/src/screens/ProfileScreen.tsx`, tests · Scope: XS · Depends on: T5

### Checkpoint C
- [ ] Manual (yours): sign in as a user with no `display_username`, confirm the nudge shows on home and profile, dismiss works, reappears on reload
- [ ] All gates green, no regression vs baseline

## Phase D — Operational + wrap-up

### T7: Confirm/schedule `backfill_display_usernames` prod run
- [ ] Check whether it's already been run in prod (per the open checkpoint in `tasks/todo-display-username.md`); if not, schedule it — **needs `CLERK_SECRET_KEY` in the Render shell for the one run, same as originally approved 2026-09-21**
- [ ] On completion, close the checkpoint in `tasks/todo-display-username.md` and its "Every user must have a display_username" follow-up line
- Acceptance: command has been run (or a concrete date is scheduled) against prod data
- Verify: re-run with `--dry-run` afterward — no changes reported
- Files: none (operational) · Scope: XS (operator) · Depends on: none, do any time

### T8: Full gates sweep + close spec success criteria
- [ ] All gates, fresh, recorded here: `manage.py test`, `makemigrations --check`, `npx jest`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web`
- [ ] Walk every bullet in `SPEC-username-onboarding.md`'s Success Criteria and confirm each is met
- Acceptance: no regression vs T0 baseline; every success criterion checked off
- Files: this file · Scope: S · Depends on: T4, T6, T7

### Checkpoint D / Final
- [ ] Spec success criteria all met
- [ ] Human review, then PR using the org PR template

---

## Notes

- `has_username` (T1) was not in the original spec's Project Structure list — added during planning after finding `ProfileSerializer`/`UserSerializer` already collapse a null `display_username` into the literal `"Anonymous"` string, which would otherwise make T5's gate impossible to implement correctly. See `tasks/plan-username-onboarding.md` Architecture Decisions.
