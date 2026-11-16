# Todo: Search-First Landing Page

Plan: `tasks/plan-landing-flow.md`. Spec: `SPEC-landing-flow.md`. Branch `v2`.
Backend tests from `backend/`: `python manage.py test`. Frontend gates from `frontend/`:
`npx jest`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web`.
Mockup: https://claude.ai/artifact/Fc5oxgywnrSDmRk2NSTttd

## Tasks

### T1: Signed-out search is covered by a test (backend) — done
- [x] Test: an unauthenticated POST to `search/` (provider mocked) returns 200, not 401/403; also with a stale Bearer token (`test_signed_out_search_is_allowed_even_with_a_stale_token`)
- [x] Existing rate-limit tests still pass (12 tests in `movie_csv.test_youtube_search`)
- Acceptance: the signed-out behavior the landing page depends on is locked in by a test; no change to `views/api.py`
- Verify: `python manage.py test movie_csv.test_youtube_search`
- Files: `backend/movie_csv/test_youtube_search.py` · Scope: XS

### T2: pendingLog storage module — done
- [x] `src/lib/pendingLog.ts`: `savePendingLog`, `readPendingLog`, `clearPendingLog` (all async)
- [x] Uses `@react-native-async-storage/async-storage` on every platform (already a dependency; it is `localStorage`-backed on web), so no Platform branching and no new package. Replaces the plan's secure-store default. Every access in try/catch
- [x] 24h expiry on read (expired entries are cleared and return null)
- [x] Malformed JSON returns null; `rating` clamped to 1–5; `reviewText` capped at 2000 characters
- [x] Stores only `{youtubeId, rating, reviewText, savedAt}` (nothing about the user)
- Acceptance: round trip works; expired, malformed and throwing storage all return null without throwing
- Verify: `npx jest src/lib/__tests__/pendingLog.test.ts`
- Files: `frontend/src/lib/pendingLog.ts` (new), `frontend/src/lib/__tests__/pendingLog.test.ts` (new) · Scope: S

### T3: Search errors the UI can tell apart — done
- [x] New `searchYoutube(query)` in `src/api/videos.ts` returns `{ results, status: 'ok' | 'rate_limited' | 'unavailable' | 'cancelled' | 'error' }` (429, 503, aborted, other). `cancelled` was added so the page can ignore a replaced query
- [x] `fetchYoutubeResults` keeps its current signature and behavior so existing callers are unchanged
- [x] Accepts an `AbortSignal` so a newer query cancels the older one
- Acceptance: 429 maps to `rate_limited`, 503 to `unavailable`, network failure to `error`, success to `ok` with mapped results
- Verify: `npx jest src/api` (new test file with axios mocked)
- Files: `frontend/src/api/videos.ts`, `frontend/src/api/__tests__/searchYoutube.test.ts` (new) · Scope: S

### T4: usePendingLogReplay + mount in root layout — done
- [x] **Prove-It test first:** two simultaneous sign-in signals create exactly one log
- [x] `src/hooks/usePendingLogReplay.ts`: when signed in and a pending log exists, call `getOrCreateVideoEssayByYoutubeId`, then `createLog` with `{essay, date: today, rating, review_text}`
- [x] Clear the pending log only after `createLog` succeeds; in-flight guard prevents a second run
- [x] On 422 or network failure: keep the pending log and show a toast (no retry loop: a failed pending log is skipped until the app is reopened, but a newer one still replays)
- [x] Does nothing when signed out or when no pending log exists
- [x] Mounted in `app/_layout.tsx` next to `useShareIntentRouter()`
- Acceptance: signed in + pending log → one resolve call, one create call, pending cleared, success toast; failure leaves pending in place
- Verify: `npx jest src/hooks/__tests__/usePendingLogReplay.test.ts`
- Note: `app/__tests__/_layout.test.tsx` now mocks the hook, like it already does for `useShareIntentRouter`.
- Files: `frontend/src/hooks/usePendingLogReplay.ts` (new), its test (new), `frontend/app/_layout.tsx` · Scope: M

### Checkpoint A — logic verified, no UI yet
- [x] `npx jest` green (50 suites, 349 tests)
- [x] `npx tsc --noEmit` shows no new errors in touched files
- [x] `python manage.py test movie_csv.test_youtube_search` green (12 tests)
- [x] `npx expo export --platform web` succeeds
- [ ] Review with you before building UI

### T5: RatingSheet and AccountSheet components — done
- [x] `RatingSheet`: essay title, channel, tappable stars (`TappableRatingDots`), optional review field, **Log it** disabled until a rating, Cancel
- [x] `AccountSheet`: shows the pending log (thumbnail, title, stars), `GoogleButton`, "Create account with email" (to `/sign-up`), "Log in" (to `/sign-in`), Back to rating
- [x] Both are RN `Modal`s with `accessibilityViewIsModal`, Escape closes on web, focus ring visible
- [x] **Log it** is double-tap safe (one `onSubmit` call)
- [x] Colors and fonts from `constants/theme.ts`; spacing on the 4px scale
- Acceptance: component tests pass; rating required; double tap fires once; Back returns to rating without losing it
- Verify: `npx jest src/components/__tests__/RatingSheet.test.tsx src/components/__tests__/AccountSheet.test.tsx`
- Note: both share a small `BottomSheet` (RN `Modal`, scrim, 480px max width). Not yet mounted anywhere, so the web export does not exercise them until T6. Escape-to-close on web and the visual result are unchecked until T6/T8.
- Files: `frontend/src/components/RatingSheet.tsx`, `AccountSheet.tsx` (new) and tests (new) · Scope: M

### T6: Rewrite SignedOutHomeScreen as search-first — done
- [x] Headline + one-line pitch + search box as the hero; feature list and hero "Create account" button removed
- [x] Search: 400ms debounce, 3-character minimum, abort previous request, uses `searchYoutube`
- [x] Empty query shows popular essays (`fetchPopularVideoEssaysPublic`), fetched after first paint
- [x] Messages: `rate_limited` → "Too many searches. Try again in a minute"; `unavailable` → falls back to DB-only results; `error` → retry link
- [x] Tap a result opens `RatingSheet`; **Log it** saves the pending log (T2) then opens `AccountSheet`; Cancel discards it
- [x] No storage or `Modal` access during render (static web export safe)
- [x] Update `SignedOutHomeScreen.test.tsx` (the feature-icon test is obsolete and is replaced, not skipped)
- Acceptance: all UI success criteria in the spec pass in component tests; `HeroGate` still renders it on web
- Verify: `npx jest src/screens/__tests__/SignedOutHomeScreen.test.tsx "app/(home)/__tests__/index.test.tsx"`
- Notes: `unavailable` (503) falls back to a new `searchDataBasePublic` (GET `VideoEssays/?search=`, AllowAny). `RatingSheet` gained `initialRating`/`initialReview` so Back from the account sheet keeps the visitor's answer. Result links go through `extractYoutubeId` from `shareIntent.ts`, so there is one parser (spec Open Question 5). The exported `dist/index.html` contains the new headline and search box. Visual check and the LCP comparison are still T8.
- Files: `frontend/src/screens/SignedOutHomeScreen.tsx`, its test · Scope: M

### T7: Log in button on the native top bar
- [ ] `MobileTopNav` shows "Log in" at the right when signed out (web keeps `WebNav`'s existing Log in / Sign up)
- [ ] Hidden on auth routes
- Acceptance: native signed-out users see Log in top right; signed-in layout unchanged
- Verify: `npx jest components` (new or updated nav test)
- Files: `frontend/components/ui/MobileTopNav.tsx` and test · Scope: S

### Checkpoint B — automated gates
- [ ] `npx jest` green
- [ ] `npx tsc --noEmit` (no new errors), `npm run lint` (no new warnings)
- [ ] `npx expo export --platform web` succeeds
- [ ] `python manage.py test` green
- [ ] Review with you before manual verification

### T8: Manual verification (web + Android)
- [ ] Web, email sign-up: search, rate, Create account with email, verify, land on home, log is in the diary
- [ ] Web, Google: same, through the OAuth redirect; confirm the log survived the page reload
- [ ] Web: reload on the rating screen, then sign in; log still replays once
- [ ] Web: wait past 24h expiry (set `savedAt` back by hand in storage); pending ignored
- [ ] Android emulator: search, rate, Google sign-in, log saved
- [ ] Rate limit: 31 searches inside a minute shows the "try again" message
- [ ] Offline during replay: pending kept, toast shown, replays on next app open
- [ ] LCP on Slow 4G compared with the numbers in `tasks/plan-lcp.md`
- Record results in this file under each box.

### T9: Polish pass (optional)
- [ ] Apply the `/unslop` findings: sentence-case labels instead of uppercase tracked, no italic emphasis, 4px spacing, line icons instead of glyphs, plain focus ring, real thumbnails
- Acceptance: no item left on the unslop audit list for this screen
- Verify: screenshot web and Android at phone width, light and dark
- Files: the files touched in T5 and T6 · Scope: S

## Open items to settle before or during the work
- [ ] Confirm the account sheet uses buttons into the existing sign-up and sign-in screens instead of inline email fields (plan, Key Decisions)
- [ ] Popular list size for signed-out users (mockup shows 6)
- [ ] Duplicate log behavior: replay creates a second log if the essay was already logged (default, since `rewatch` exists)
