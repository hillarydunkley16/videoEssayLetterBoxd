# Spec: Username Onboarding

Follows on from `SPEC-display-username.md` (which captures Clerk's `username` claim into
`Profile.display_username` on auth) and closes its open follow-up: *"Every user must have a
`display_username` — enforce at sign-up / finish backfill, then remove the caveat"*
(`tasks/todo-display-username.md`).

## Objective

Today `username` is one of five fields on a single sign-up page
(`frontend/app/(auth)/sign-up.tsx`), sent straight to Clerk with no availability feedback until
the whole form is submitted. Two problems follow: new users can pick a taken username and only
find out after submitting, and any user who signs up without one (or existed before the
`display_username` claim was added) is permanently invisible to People search
(`SPEC-find-people.md` decision 4).

This spec covers making the existing username field a checked, live-validated part of sign-up —
availability + suggestions as the user types, inline on the current page — plus closing the gap
for users who already exist without one.

**Users:** anyone signing up for the app (new-user flow); anyone with an existing account and no
`display_username` (soft in-app nudge).

**Success looks like:** every new signup leaves with a unique, confirmed username; every existing
user is nudged (not blocked) until they have one; nobody appears in People search results with no
name to show.

## Scope (single capability, no capability map needed)

Three sequential slices of one feature, not independent modules — deferred to Plan/Tasks:
1. Live username availability + suggestions on the existing sign-up field (backend endpoint + frontend debounce/inline UI)
2. Soft in-app gate for existing usernameless users
3. Run the already-built `backfill_display_usernames` command in prod (operational prerequisite, not new code — see `tasks/todo-display-username.md` T7)

## Decisions (from spec review, 2026-09-22)

1. **Inline on the existing single sign-up page** (revised 2026-09-22 — see Feasibility note below). `username` stays exactly where it is today, alongside first name, last name, email, and password, all sent together in one `signUp.create()` call — no second page, no change to the verification flow. What changes is the field itself: debounced live availability checking as the user types, with inline suggestions when taken, and the submit button gated on a known-available username (same pattern already used for `!emailAddress || !password`).
   - **Feasibility note:** a two-step ("Instagram-style") flow was the original plan, but it required making `username` optional-at-creation in Clerk's dashboard (confirmed currently required — see resolved Open Question 1 below), which blocked the start of implementation on a manual console change. Doing the check inline keeps `username` in the original `create()` call, so that precondition goes away entirely. Trade-off: less of a dedicated "claim your handle" moment, but the core goal (catch a taken username before submit, with suggestions) is fully met with less new code and no external dependency.
2. **Availability checked against our own DB** (`Profile.display_username`), not Clerk per-keystroke. Fast and fully in our control; matches how `display_username` is already populated (on auth). New endpoint, public (`AllowAny`) — see Risk below on why it can't require auth.
3. **Username is still sent to Clerk** exactly as today, inside `signUp.create({..., username})` — the existing `ClerkAuthentication` → `Profile.display_username` pipeline is untouched. Clerk remains the final authority on uniqueness/format; our endpoint is a UX layer in front of it, not a replacement.
4. **Existing usernameless users get a soft, dismissible gate** — a banner/prompt nudging them to set a username, not a blocking modal. They can keep using the app; they just stay invisible to People search until they set one. Shown on **two mount points: the home feed (`app/(home)/index.tsx`) and the profile tab (`app/(tabs)/profile.tsx`)**, both gated on `display_username == null`. Dismiss is **session-only** (plain component/local state, no storage) — it reappears next app open until a username is actually set, since the whole point is closing the invisibility gap rather than letting it be permanently waved off.
5. Backfill (`backfill_display_usernames`) is the remediation for pre-existing users where Clerk *does* already have a username but our DB hasn't synced it — this spec's job is to confirm/schedule that run, not rebuild it.

## Tech Stack

No new dependencies. Same stack as the rest of the app:
- Backend: Django/DRF, `movie_csv/views/api.py` + `movie_csv/serializers.py`, `Profile.display_username`
- Frontend: Expo/React Native, `@clerk/clerk-expo`'s `useSignUp`, `frontend/app/(auth)/sign-up.tsx`
- Auth: Clerk (`signUp.create` / `signUp.update` / `signUp.attemptEmailAddressVerification`)

## Commands

Same as documented in `CLAUDE.md` — no new commands. Relevant subset:
```
Backend: cd backend && python manage.py test movie_csv.test_username_availability
Frontend: cd frontend && npx jest app/\(auth\)/__tests__/sign-up.test.tsx
          npx tsc --noEmit
          npm run lint
```

## Project Structure

```
backend/movie_csv/views/api.py        → new UsernameAvailability view (AllowAny)
backend/movie_csv/urls/api.py         → users/username-available/ route
backend/movie_csv/test_username_availability.py  → new
frontend/app/(auth)/sign-up.tsx       → add debounced live check + inline suggestions to the existing username field; gate submit on known-available
frontend/src/api/users.ts             → checkUsernameAvailability(candidate)
frontend/src/components/UsernameGateBanner.tsx  → new, soft nudge for existing users; session-only dismiss (local state)
frontend/app/(home)/index.tsx         → mounts the banner (display_username == null)
frontend/app/(tabs)/profile.tsx       → mounts the banner (display_username == null)
```

## Code Style

Match existing conventions exactly — see `SPEC-find-people.md` and `SPEC-display-username.md` for
precedent (viewer-relative fields, `select_related`/`prefetch_related` for constant query counts,
`assertNumQueries` in tests, debounced search patterns already built in `PeopleResults.tsx` /
`ListResults.tsx` — the new username-availability check should reuse that debounce pattern, not
reinvent one).

Availability endpoint response shape:
```json
{ "available": false, "suggestions": ["janedoe2", "janedoe_", "janedoe99"] }
```

## Testing Strategy

Same per-concern-file convention as the rest of the backend suite (see `CLAUDE.md`):
- `test_username_availability.py`: taken/available; case-insensitivity; format rejection (matches Clerk's rules); suggestions are themselves available; constant query count; public (no auth required)
- Frontend: Jest test for the sign-up form's debounce + stale-response guard on the availability check (mirrors existing `PeopleResults`/`ListResults` tests), suggestion tap-to-fill, submit disabled while unresolved/taken, and unchanged behavior when the check errors/times out (submit falls back to Clerk's own validation rather than blocking forever); `UsernameGateBanner` test (shows only when `display_username` is null, dismiss hides it, doesn't block navigation) plus a render check on both `(home)/index.tsx` and `(tabs)/profile.tsx` that it mounts there and stays absent once a username is set
- No coverage threshold — same as the rest of this project; gates are `tsc --noEmit`, `expo lint`, `expo export --platform web` passing plus the new/existing tests green

## Boundaries

- **Always:** keep `Clerk` as final uniqueness/format authority (never let our DB check alone decide a username is claimable); keep the other four sign-up fields and the email-verification flow unchanged; run full backend + frontend gates before considering this done, per `CLAUDE.md`.
- **Ask first:** any Clerk **dashboard** configuration change (none currently needed — the inline approach keeps `username` required-at-creation exactly as Clerk has it today; revisit only if this changes); running the backfill command in prod; adding any new dependency.
- **Never:** store or transmit a username that hasn't round-tripped through Clerk's own `create()` call; block a user's use of the app over a missing username (decision 4); add a uniqueness DB constraint on `display_username` (explicitly rejected in `SPEC-display-username.md` — Clerk enforces it, a DB constraint could block login).

## Success Criteria

- Sign-up: the existing username field shows live availability as the user types (debounced) and, when taken, at least 3 available suggestions computed from their input; the other fields and submit flow are otherwise unchanged
- Submit is disabled while the username is empty, still checking, or known-taken; chosen username is confirmed unique by Clerk on `signUp.create()` regardless — a race where our DB said "available" but Clerk rejects it surfaces as a clear inline error via the existing `getClerkErrorMessage` path, not a crash
- Existing users with `display_username IS NULL` see a dismissible nudge on the home feed and their profile tab; dismissing does not block any other screen or action and the nudge reappears next app open until a username is set
- `backfill_display_usernames` has been run against prod (or is explicitly scheduled) and the checkpoint in `tasks/todo-display-username.md` is closed
- No regression: `manage.py test`, `npx jest`, `tsc --noEmit`, `npm run lint`, `expo export --platform web` all match or improve on the current baseline (see `tasks/todo-find-people.md` T0 for the reference numbers)

## Open Questions

1. ~~Is `username` currently a *required* Clerk attribute at `signUp.create()` time?~~ **Resolved (2026-09-22): yes, confirmed in the Clerk dashboard.** No longer a blocker: the inline-on-existing-page approach (decision 1) keeps `username` inside the original `create()` call exactly as it is today, so no Clerk dashboard change is needed and there's no T0 precondition. (If a future revision ever moves username collection out of the initial `create()` call again, this constraint returns.)
2. ~~Suggestion algorithm specifics~~ **Resolved: confirmed.** Base username + numeric/underscore suffixes, checked in one query against `display_username__istartswith=base`, returning the first 3 gaps.
3. ~~Where does the existing-user banner live?~~ **Resolved: home feed (`(home)/index.tsx`) + profile tab (`(tabs)/profile.tsx`)**, not global, not profile-only.
4. ~~Dismiss persistence?~~ **Resolved: session-only** — local component state, no storage; reappears next app open until a username is set.

None open — ready for Plan.
