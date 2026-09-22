# Todo: Share-to-App (YouTube Share Sheet → Start a Log)

Plan: `tasks/plan-share-to-app.md`. Spec: `tasks/spec-share-to-app.md`. Branch `v2`.
Backend tests from `backend/`: `python manage.py test`. Frontend gates from `frontend/`:
`npx jest`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web`.

## Tasks

### T1: oEmbed metadata service (backend) — done (5ee2e49)
- [x] `movie_csv/services/youtube_oembed.py`: `fetch_oembed_metadata(youtube_id) -> dict`
      hitting `https://www.youtube.com/oembed?url=...&format=json`, mapping
      `title`→title, `author_name`→channel_name, `thumbnail_url`→thumbnail
- [x] Raises/returns a clean error signal (not an unhandled exception) on a 404/invalid id
- [x] Test with the real oEmbed HTTP call mocked (`unittest.mock` / `responses`) —
      covers success shape and the 404 case
- Acceptance: function returns the three fields for a real-shaped mocked response;
  raises a typed exception (not a bare `requests.HTTPError`) on 404
- Verify: `python manage.py test movie_csv.test_youtube_oembed`
- Files: `backend/movie_csv/services/youtube_oembed.py` (new),
  `backend/movie_csv/test_youtube_oembed.py` (new) · Scope: XS

### T2: get-or-create VideoEssay-by-youtube_id endpoint (backend) — done (fe42eaf)
- [x] New view (`VideoEssayFromYoutubeId`) — `POST /api/VideoEssays/from-youtube-id/`,
      `IsAuthenticated` via DRF's project-wide default
- [x] Look up by `youtube_id` first (`filter().first()`); only call `fetch_oembed_metadata`
      on an actual miss — avoids the double-fetch flagged in the plan's risks
- [x] Returns `VideoEssaySerializer` output (has `public_id`) with 200 on reuse, 201 on create
- [x] Invalid/unresolvable youtube_id → clean 422 (using T1's typed exception), not a 500
- [x] Anonymous POST → 401/403 (matches every other write-side view)
- Acceptance: repeat POST with same youtube_id returns the same `public_id`, no duplicate
  row, no second oEmbed call (assert via mock call count)
- Verify: `python manage.py test movie_csv.test_video_essay_from_share`
- Files: `backend/movie_csv/views/api.py`, `backend/movie_csv/urls/api.py`,
  `backend/movie_csv/test_video_essay_from_share.py` (new) · Scope: S

### Checkpoint A — backend slice verified
- [x] `python manage.py test` full suite green (298 tests)
- [x] Manual curl against a real youtube_id confirms real oEmbed shape matches what
      T1 assumed — `title`/`author_name`/`thumbnail_url` all present as expected,
      no mapping fix needed

### T3: frontend API client function — done (438e38d)
- [x] `src/api/videos.ts`: `getOrCreateVideoEssayByYoutubeId(youtubeId, token)` calling
      T2's endpoint via `authFetch`/`useAuthPost` pattern (matches `getAVideoEssay`)
- [x] Surfaces the backend's 4xx (invalid video) as a typed error the caller can show
      (authFetch already throws `API error: <status> — <body>` on a non-2xx; propagated as-is)
- Acceptance: function shape matches existing `videos.ts` conventions (async, typed
  return using `VideoEssayData`)
- Verify: `npx tsc --noEmit`
- Files: `frontend/src/api/videos.ts` · Scope: XS

### T4: shared-URL → youtube_id parser (frontend, parallel to T1-T3) — done (438e38d)
- [x] `src/lib/shareIntent.ts`: `extractYoutubeId(sharedText: string): string | null`
      handling `youtu.be/<id>`, `youtube.com/watch?v=<id>` (v= anywhere in the query
      string, not just first), `youtube.com/shorts/<id>`, and share text with extra
      surrounding words/title before the URL
- [x] Unit tests for all input shapes plus non-YouTube/empty text (returns null) — 10 cases
- Acceptance: all test cases pass; no false-positive match on a non-YouTube URL
- Verify: `npx jest src/lib/__tests__/shareIntent.test.ts`
- Files: `frontend/src/lib/shareIntent.ts` (new), test (new) · Scope: XS

### T5: Android share-intent wiring (native config + listener) — implemented (407eeb4), manual device check still needed
- [x] Add `expo-share-intent` to `frontend/package.json`, register plugin in `app.json`
      (`androidIntentFilters: ["text/*"]`, `disableIOS: true` — Android-only per spec)
- [x] `expo prebuild --platform android --clean` run directly (native dirs are gitignored,
      confirmed disposable) — verified `AndroidManifest.xml` gets the expected
      `ACTION_SEND` / `text/*` intent-filter with no conflicts against the existing
      plugins; `android.package` auto-set to `com.hillarydunkley.frontend`
- [x] `src/hooks/useShareIntentRouter.ts`, wired into `_layout.tsx`: on share-intent
      received, runs T4's parser, calls T3's function, `router.push` to
      `(modals)/quickLog?essayId=<public_id>`. Signed-out shares are dropped here
      (reset, no navigate) — resume-after-sign-in is T6, not this task
- [x] Web build unaffected — `npx expo export --platform web` still succeeds
- [ ] **Acceptance (needs you):** sharing a real YouTube URL from the Android YouTube
      app to a dev-client build of Visual Arguments opens the app and navigates to
      `quickLog` with the right essay — no automated test can drive a real OS share
      sheet or a real device; requires `eas build --profile development --platform
      android` or `npx expo run:android` and a physical/emulated Android device,
      neither of which exist in this environment
- Verify: `python manage.py test` (backend, unaffected) — n/a here; `npx jest --forceExit`
  (183 passed), `npx tsc --noEmit` (only pre-existing errors), `npx expo export --platform
  web` (succeeds) all done; the on-device share itself is the one remaining manual step
- Files: `frontend/app.json`, `frontend/package.json`, `frontend/package-lock.json`,
  `frontend/app/_layout.tsx`, `frontend/src/hooks/useShareIntentRouter.ts` (new + test)
  · Scope: M

### Checkpoint B — core mechanism verified end-to-end
- [ ] Manual Android dev-client share → app → `quickLog` populated, confirmed working
      before adding signed-out handling
- [ ] `npx expo export --platform web` still succeeds (plugin doesn't break web build)

### T6: signed-out share → sign-in → resume flow
- [ ] Spike first: confirm whether Clerk's sign-in web view on Android kills the JS
      runtime (determines in-memory vs. `expo-secure-store` for the pending youtube_id —
      per spec's open question 2)
- [ ] Hold the pending youtube_id across the redirect using whichever mechanism the
      spike confirms is needed
- [ ] After successful sign-in, resume into `quickLog` for the held video instead of
      the default post-sign-in destination
- Acceptance: sharing while signed out → sign-in/up flow → lands on `quickLog` for the
  originally-shared video, not the home screen
- Verify: manual, on the same Android dev-client build
- Files: `frontend/app/(auth)/_layout.tsx` or `sign-in.tsx`/`sign-up.tsx`,
  `frontend/src/lib/shareIntent.ts` (extend) · Scope: S

### T7: full verification pass
- [ ] All Success Criteria in `tasks/spec-share-to-app.md` checked off
- [ ] `python manage.py test`, `npx jest`, `npx tsc --noEmit`, `npm run lint`,
      `npx expo export --platform web` all green
- [ ] Manual re-check: existing (non-share) log flow (search → quickLog) unaffected
- Verify: run every command above; report results
- Files: none (verification only) · Scope: XS

## Deferred — explicitly out of scope here

- [ ] **iOS Share Extension.** Needs its own spec (native extension target, App Group
      entitlement, Info.plist config, App Store review implications) — not started here.
- [ ] **YouTube Data API integration** for `duration`/`views`/`channel_url` at share-time.
      Only revisit if oEmbed's fields prove insufficient in practice (per spec decision 2).
