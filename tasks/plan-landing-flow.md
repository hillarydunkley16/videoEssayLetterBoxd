# Implementation Plan: Search-First Landing Page

Traces to `SPEC-landing-flow.md`. Branch `v2`. Task list: `tasks/todo-landing-flow.md`.
Distinct from the in-flight deploy work in `tasks/plan.md` / `tasks/todo.md` — do not touch those.

## What the codebase already gives us

Checked before planning; each of these removes work the spec had assumed.

| Spec assumption | What exists | Effect on the plan |
|---|---|---|
| Signed-out search needs wiring | `fetchYoutubeResults(query)` in `src/api/videos.ts` already POSTs `search/` with no token | Reuse it. It swallows every error and returns `[]`, so a 429/503 is invisible. T3 fixes that. |
| Resolve the essay after sign-in | `getOrCreateVideoEssayByYoutubeId(youtubeId, token)` exists | Replay calls it, then `createLog`. No new API. |
| Build an email + Google sign-up form in the sheet | `GoogleButton` component and `(auth)/sign-up`, `(auth)/sign-in` screens already own Clerk verification, errors and the username step | The account sheet uses `GoogleButton` plus links to the existing screens. It does not rebuild Clerk forms. **This differs from the mockup, which shows inline email and password fields.** |
| Add a top-right Log in | `WebNav` already shows "Log in" and "Sign up" top right when signed out. `MobileTopNav` is `SignedIn`-only, so native has none | T7 adds it for native only. Nothing to add on web. |
| Replay must wait for the username step (Open Question 1) | `UsernameGateBanner` is a soft nudge. No backend check blocks `createLog` on `display_username` | Resolved: replay can fire as soon as the user is signed in. |
| Mount the replay on the home screen | After sign-in/up the auth screens `router.replace('/')`, but new Google users may pass through `choose-username` first | Mount the replay hook in `app/_layout.tsx` beside `useShareIntentRouter()`, so it runs on whatever screen the user lands on. |

## Dependency Graph

```
T1 backend: signed-out search test        (independent)
T2 pendingLog storage module              (independent)
T3 search error signaling                 (independent)
       │
T2 ──→ T4 usePendingLogReplay + mount in root layout   (uses T2, existing resolve + createLog)
       │
       └──→ Checkpoint A (logic verified, no UI yet)
                │
T2, T3 ──→ T5 RatingSheet + AccountSheet components
                │
                └──→ T6 SignedOutHomeScreen rewrite   (uses T2, T3, T5)
T7 MobileTopNav signed-out Log in                      (independent)
                │
                └──→ Checkpoint B (all automated gates)
                         │
                         └──→ T8 manual verification (web + Android)
                                  │
                                  └──→ T9 polish pass (/unslop findings)
```

T1, T2, T3 and T7 touch separate files and can be done in any order. T4 is the first slice that
proves the whole mechanism (store, sign in, replay, one log) with no UI.

## Vertical Slices (why this order)

1. **T1, T2, T3: independent foundations.** Each is testable with jest or `manage.py test` and needs no device.
2. **T4 before any UI.** The riskiest behavior is the replay: exactly-once, survives the OAuth redirect, failure keeps the pending log. Build and test it against the real `getOrCreate...` and `createLog` calls before screens depend on it.
3. **T5 then T6.** Sheets are built as standalone components with their own tests, then the landing screen composes them. This keeps the T6 diff to wiring and layout.
4. **T7 is tiny and separate**, so a nav change never hides inside the screen rewrite.
5. **T8 is a manual checkpoint.** No automated test drives a real Google OAuth redirect or a real page reload.

## Key Decisions Made in This Plan (flag if you disagree)

- **Storage adapter:** `localStorage` on web, `expo-secure-store` on native, behind one async API (`save/read/clear`). `expo-secure-store` is already a dependency, so no new package. It has a size limit of roughly 2KB per value on some platforms; a pending log (id, rating, review text) is small, but T2 caps `reviewText` length.
- **Sheets are React Native `Modal`s**, not `@gorhom/bottom-sheet`. The landing page is not inside a modal route, and `Modal` behaves the same on web, iOS and Android.
- **Account sheet = `GoogleButton` + "Create account with email" (to `/sign-up`) + "Log in" (to `/sign-in`).** The pending log is already persisted, so leaving the page to use those screens is safe.
- **Replay on 422 or network failure:** keep the pending log, show a toast with a retry on next app open. Never loop.

## Risks and Mitigations

- **Double replay or double log (high).** The root layout can re-render and Clerk reports signed-in more than once. Mitigation: a module-level in-flight flag plus clearing the pending log before the `createLog` response is trusted to be final is wrong (loses the log on failure), so instead: set in-flight, call, clear only on success, and write the Prove-It test first (T4).
- **Static web export (medium).** `HeroGate` renders the signed-out view into static HTML. The new screen must not touch `localStorage` or `Modal` during render. Mitigation: all storage in effects and handlers; `expo export --platform web` is a Checkpoint B gate.
- **LCP regression (medium).** The old hero was the LCP element on purpose. The new LCP is the headline and search box. Mitigation: keep the popular list below the fold and fetched after first paint; compare against `tasks/plan-lcp.md` numbers during T8.
- **SerpAPI cost from anonymous traffic (medium).** Existing 30/min/IP limit and cache stay. Mitigation: debounce (400ms), minimum 3 characters, and abort the previous request when the query changes. Watch SerpAPI usage in the first week after deploy.
- **Google OAuth on web reloads the page (medium).** That is why the pending log is persisted. Verified manually in T8.
- **Mockup deviation (low).** Inline email fields in the mockup become buttons that open existing screens. If you want the inline form, T5 grows by a Clerk sign-up form with email verification, which is a larger task. Say so before T5 starts.

## Verification Checkpoints

- **Checkpoint A (after T4):** `npx jest`, `npx tsc --noEmit`, backend `python manage.py test movie_csv.test_youtube_search`. No UI changes yet.
- **Checkpoint B (after T7):** full jest, `tsc`, `npm run lint`, `npx expo export --platform web`, full backend suite.
- **T8:** manual script in the todo.
