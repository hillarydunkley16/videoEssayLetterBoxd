# Spec: Search-First Landing Page (search, log, then create an account)

Branch: `v2`. Single capability (signed-out search, rate, then create an account to save the log), so no capability map is needed.

UI mockup (interactive, uses example content): https://claude.ai/artifact/Fc5oxgywnrSDmRk2NSTttd

## Objective

A signed-out visitor lands on a page where the search box is the hero. They search for a video essay, tap it, rate it (optionally add a review), and only then are asked to create an account. The log they just made is saved when they finish signing up. A **Log in** button sits in the top right for returning users.

Today the signed-out home screen is a marketing hero (`SignedOutHomeScreen.tsx`) with a "Create account" CTA, so the first thing a visitor does is sign up. The change moves the account prompt to the point where the visitor has already invested effort and has something to save.

**Users:** first-time visitors (closed beta, arriving by link) and returning users who are signed out.

**Success looks like:** a new visitor goes from landing to a saved first log in one session, and the account prompt appears only after they pick a rating.

## Decisions (confirmed)

1. **Pending log storage:** client-side replay. The signed-out visitor's `{youtube_id, rating, review_text}` is held on the client. After Clerk sign-in/up completes, the app calls the existing `POST /api/video-essay-from-youtube-id` flow (get-or-create) and then `createLog`. No backend model, no migration, no guest token.
2. **Persistence:** the pending log is persisted (not memory-only) so a web reload or the Google OAuth redirect does not lose it. It expires after 24 hours. Storage access is wrapped in try/catch and the page works without it (same rule as `signedInHint.ts`).
3. **Signed-out search limits:** keep the existing limits on the `search/` view (30 requests per client IP per 60s, response cache, 503 when `SERPAPI_KEY` is missing). Add client-side debounce and a minimum query length. No new backend throttle.
4. **Old hero:** replaced. The search box is the hero, with a one-line value pitch. The feature list and the "Create account" hero CTA go away. The signed-in home screen is untouched.

## Assumptions to correct if wrong

1. `search/` (`youtube_search` in `views/api.py`) is a plain Django view with `@csrf_exempt` and no auth check, so signed-out calls already work. This spec adds a test that locks that in and does not change the view.
2. Search results from `search/` carry enough to render a row (title, channel, thumbnail, duration) and to derive a `youtube_id`. The get-or-create endpoint that resolves it needs a signed-in user (`owner=request.user`), so resolving happens after sign-in, not before.
3. Expo web is the primary target for this page, then iOS and Android from the same code. There is no responsive layer, so the layout is a phone-width column, as elsewhere in the app.
4. `HeroGate` keeps its job: on web it renders the signed-out view while Clerk loads so the hero is in the static HTML (LCP). The new search-first view must be safe to render statically.
5. The existing 24h pending-share design in `tasks/spec-share-to-app.md` is single sign-in only. This feature needs persistence across the OAuth redirect, so it gets its own small module instead of reusing that one.

## Tech Stack

- Frontend: Expo SDK / expo-router / React Native (web, iOS, Android), `@clerk/clerk-expo`, `@gorhom/bottom-sheet` already used for `quickLog`.
- Backend: Django + DRF, Clerk JWT auth. No backend code change expected.
- Design tokens: `frontend/constants/theme.ts` (cobalt accent, teal secondary, Fraunces display, Inter body, light and dark).

## User Flow

1. Landing: top bar (wordmark left, **Log in** right), headline, search box, "Popular this week" list.
2. Typing (3+ characters, debounced) shows results from `search/`. Empty query shows popular essays from the existing public popular endpoint.
3. Tap a result, a rating sheet opens (stars required, review optional). **Log it** is disabled until a rating is chosen.
4. **Log it** stores the pending log and opens the account sheet: shows the pending log (thumbnail, title, stars), "Continue with Google", and email sign-up, with a switch to Log in.
5. On successful sign-in/up the app replays the pending log (resolve essay, create log), clears the pending log, and shows a saved confirmation, then the diary/feed.
6. Top-right **Log in** with nothing pending opens the same sheet without a pending log.
7. Cancelling the rating sheet discards the pending log. Dismissing the account sheet keeps it (so Back returns to the rating).

## Commands

Backend (from `backend/`):
```
python manage.py test movie_csv.test_youtube_search          # signed-out search behavior
python manage.py test                                        # full suite
```
Frontend (from `frontend/`):
```
npx jest src/lib/__tests__/pendingLog.test.ts
npx jest src/screens/__tests__/SignedOutHomeScreen.test.tsx
npx jest "app/(home)/__tests__/index.test.tsx"
npx jest                                                     # full suite
npx tsc --noEmit
npm run lint
npx expo export --platform web                               # must still succeed (static render)
npx expo start --web                                         # manual check
```

## Project Structure

```
frontend/src/screens/SignedOutHomeScreen.tsx     → rewritten: search-first landing (replaces hero)
frontend/src/lib/pendingLog.ts                   → new: save/read/clear pending log with 24h expiry, guarded storage
frontend/src/lib/__tests__/pendingLog.test.ts    → new
frontend/src/hooks/usePendingLogReplay.ts        → new: after sign-in, resolve essay + createLog, clear pending
frontend/src/api/videos.ts                       → add signed-out search call (hits search/ without a token)
frontend/components/ui/HeroGate.tsx              → unchanged behavior; verify static render still works
frontend/app/(home)/index.tsx                    → mount replay hook; no other change
frontend/src/screens/__tests__/SignedOutHomeScreen.test.tsx → updated
backend/movie_csv/test_youtube_search.py         → add signed-out request test (no backend code change)
```

## Code Style

Match the existing pattern in `src/lib/signedInHint.ts`: small module, every storage access guarded, no user data beyond what is needed.

```ts
// src/lib/pendingLog.ts
export const PENDING_LOG_KEY = 'watchd:pending-log';
const TTL_MS = 24 * 60 * 60 * 1000;

export type PendingLog = { youtubeId: string; rating: number; reviewText: string; savedAt: number };

export function savePendingLog(log: Omit<PendingLog, 'savedAt'>): void {
  try {
    globalThis.localStorage?.setItem(PENDING_LOG_KEY, JSON.stringify({ ...log, savedAt: Date.now() }));
  } catch {
    // Storage blocked: the log is simply not kept across a reload.
  }
}
```

Conventions: PascalCase screen components, colors from `Colors[theme]` never literals, backend URL only through `src/api/client.ts`, 4px spacing steps, sentence-case labels.

## Testing Strategy

- **Backend (Django test runner):** one new case in `test_youtube_search.py`: an unauthenticated POST to `search/` is not rejected with 401/403 (provider mocked), and the 31st request in a window from one IP returns 429 (already covered, keep it passing).
- **Frontend unit (jest-expo):** `pendingLog` save/read/clear, expiry after 24h, malformed JSON ignored, storage that throws. `usePendingLogReplay`: calls resolve then `createLog` with the right payload exactly once, clears pending on success, keeps it and surfaces an error on 422 or network failure, does not fire when signed out.
- **Frontend component:** `SignedOutHomeScreen`: Log in is rendered top right; search below the minimum length makes no request; **Log it** disabled until a rating; **Log it** stores the pending log and opens the account sheet; cancel discards it.
- **Prove-It regression:** double-tap on **Log it** and double-fire of the replay must not create two logs (same bug class as the existing `logVideoModal` regression test).
- **Manual:** web (signed-out, Google redirect, email sign-up), Android emulator. Gates: `tsc --noEmit`, `expo lint`, `expo export --platform web`, full jest, full backend suite.

## Boundaries

- **Always:** keep the signed-in home screen unchanged; guard every storage access; debounce search; read colors and fonts from `constants/theme.ts`; run jest, `tsc`, lint and the web export before each commit; replay at most once per pending log.
- **Ask first:** adding a dependency (for example AsyncStorage if `localStorage` is not available on native); any change to `search/` rate limits or auth; any backend model or migration; changing the Clerk sign-up or username-gate flow; changing `HeroGate`'s static-render behavior.
- **Never:** store a Clerk token, password or email in the pending log; create a log on the server before the user is signed in; call SerpAPI from the frontend; hardcode the backend URL or a Clerk issuer; edit an applied migration; remove or skip the double-tap regression test.

## Success Criteria

- [ ] A signed-out visitor sees the search box, headline and a **Log in** button in the top right on first paint, on web, iOS and Android.
- [ ] Typing 3 or more characters shows search results without being signed in; fewer than 3 characters makes no request; rapid typing sends one request per pause.
- [ ] A rating is required before **Log it** is enabled; the account sheet appears only after **Log it**.
- [ ] After creating an account with Google or email, the log appears in the user's diary with the rating and review they entered, with no re-search.
- [ ] The log survives a full page reload and the Google OAuth redirect on web.
- [ ] A pending log older than 24 hours is ignored and cleared.
- [ ] If the essay cannot be resolved (422) or the network fails, the user sees a clear message, the pending log is kept, and nothing crashes.
- [ ] Double-tapping **Log it** or a double replay creates exactly one log.
- [ ] Top-right **Log in** with nothing pending signs the user in and shows no pending-log card.
- [ ] 31 searches in 60s from one IP get a 429, and the page shows a "try again in a minute" message instead of an empty list.
- [ ] A missing `SERPAPI_KEY` (503) falls back to DB-only results, per the existing behavior.
- [ ] Signed-in users see no change to the home screen.
- [ ] `expo export --platform web`, `tsc --noEmit`, `npm run lint`, `npx jest` and `python manage.py test` stay green.

## Open Questions

1. **Username gate (resolved in `tasks/plan-landing-flow.md`):** `UsernameGateBanner` is a soft nudge and nothing on the backend blocks `createLog` without a `display_username`, so the replay fires as soon as the user is signed in. The replay hook is mounted in the root layout so it runs wherever the user lands (including `choose-username`).
2. **Native persistence:** `localStorage` is web-only. For iOS and Android the options are `expo-secure-store` (already a dependency) or AsyncStorage (new dependency, ask first). Secure-store is the default unless it proves awkward for non-sensitive data.
3. **Duplicate log:** if the signed-in user already logged the same essay, should replay create a second log (the app allows rewatches) or ask? Default: create it, since `rewatch` exists on the model.
4. **Popular list for signed-out users:** confirm `fetchPopularVideoEssaysPublic` is the right source and how many rows to show (mockup shows 6).
5. **Search result to `youtube_id`:** `search/` returns SerpAPI results with a `link`; confirm the frontend parses the id the same way `shareIntent.ts` does (`extractYoutubeId`) so there is one parser.
6. **Visual polish:** the mockup was reviewed with `/unslop` (uppercase tracked labels, italic emphasis, off-grid spacing, glyph icons). Apply those fixes when implementing, not in this spec.
