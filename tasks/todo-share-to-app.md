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

### T5: Android share-intent wiring (native config + listener) — done (407eeb4), verified on-device
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
- [x] **Acceptance — verified on a local Android emulator (Pixel/Android 15,
      `google_apis` image; Android Studio + SDK installed via Homebrew for this).**
      No real YouTube app on this non-Play-Store image, so verified by firing the same
      `ACTION_SEND`/`text/plain` intent `am start` sends when a user taps a share-sheet
      target — this is the OS mechanism, not a YouTube-specific one, so it's an honest
      test of our intent-filter + handler. Two runs:
      (1) signed out → app foregrounds via `onNewIntent` (singleTask), hook resets the
      intent, home screen untouched, no crash — confirms the T6-deferred boundary is safe;
      (2) signed in (test account via Clerk `+clerk_test@` bypass) → same share →
      `quickLog` bottom sheet opened, and `VideoEssay.objects.get(youtube_id="dQw4w9WgXcQ")`
      confirms a real row was created via live oEmbed lookup (title "Rick Astley - Never
      Gonna Give You Up (Official Video) (4K Remaster)", channel "Rick Astley"). No JS
      errors/crashes in logcat either run.
- Verify: `python manage.py test` (backend, unaffected) — n/a here; `npx jest --forceExit`
  (183 passed), `npx tsc --noEmit` (only pre-existing errors), `npx expo export --platform
  web` (succeeds) all done; the on-device share itself is the one remaining manual step
- Files: `frontend/app.json`, `frontend/package.json`, `frontend/package-lock.json`,
  `frontend/app/_layout.tsx`, `frontend/src/hooks/useShareIntentRouter.ts` (new + test)
  · Scope: M

### Checkpoint B — core mechanism verified end-to-end — closed
- [x] Manual Android emulator share → app → `quickLog` populated, confirmed working
      (see T5's acceptance note above for detail)
- [x] `npx expo export --platform web` still succeeds (plugin doesn't break web build)

### T6: signed-out share → sign-in → resume flow — done (54df062), verified on-device
- [x] Spike done: this app's sign-in/sign-up is native RN screens (Clerk `useSignIn`/
      `useSignUp` hooks, in-app forms) — no WebView, no system-browser redirect, JS
      runtime never dies. **But** live testing found a *different* survival hazard the
      spike question didn't anticipate: Clerk's session activation remounts the subtree
      that owns this hook, which resets plain `useState`/`useRef` to their initial
      values before `isSignedIn` ever flips true. In-memory state is still sufficient —
      it just has to be module-level (survives a remount within the same JS process),
      not component state. No `expo-secure-store` needed.
- [x] Hold the pending youtube_id in a module-level variable in
      `useShareIntentRouter.ts` (`pendingYoutubeId`, with a `__resetPendingShareForTests`
      export for test isolation)
- [x] Once signed in, resumes into `quickLog` for the held video automatically — no
      re-share needed, confirmed live
- [x] Second bug found and fixed along the way: the effect depended on the `shareIntent`
      object itself, which `expo-share-intent` returns as a new reference every call;
      the burst of re-renders sign-in produces was restarting (and cancelling) the
      in-flight resolve before it could finish. Effects now depend only on primitives
      (`sharedText`, `isSignedIn`).
- Acceptance: sharing while signed out → sign-in → lands on `quickLog` for the
  originally-shared video, not the home screen — **verified live on the Android
  emulator**, backend confirmed a real `VideoEssay` row created
  (`youtube_id=y6120QOlsfU`, "Darude - Sandstorm")
- Verify: `npx jest --forceExit` (7/7 new tests, including 2 regression tests for the
  bugs above — the object-identity-churn one and the remount one), `npx tsc --noEmit`
  clean, `npx expo export --platform web` succeeds, full suite 186/186 passed
- Files: `frontend/src/hooks/useShareIntentRouter.ts`, its test file · Scope: S

### T7: full verification pass — done (ef08fb3)
- [x] All Success Criteria in `tasks/spec-share-to-app.md` checked off
- [x] `python manage.py test` (298 passed), `npx jest --forceExit` (187 passed, 28
      suites), `npx tsc --noEmit` (pre-existing errors only, none in share-to-app
      files), `npm run lint` (pre-existing errors only — `sign-in.tsx`, `src/api/users.ts`
      unresolved-module, `createLogScreen.tsx`'s unrelated in-progress edit; the two
      `exhaustive-deps` warnings on `useShareIntentRouter.ts` match the same pattern
      already used elsewhere, e.g. `GetVideoEssayScreen.tsx`), `npx expo export
      --platform web` (succeeds) — all green
- [x] Bug found during this pass: `useShareIntentRouter`'s resolve had no catch, so an
      unresolvable video (backend 422) propagated as an unhandled promise rejection
      instead of the spec's "clean error" criterion — silently did nothing rather than
      crashing, but no user-visible feedback either. Added a regression test
      (mocks a rejected `getOrCreateVideoEssayByYoutubeId`, asserts `Alert.alert` fires,
      no navigation, share intent still reset) and a `catch` that shows `Alert.alert`.
- [x] Manual re-check: existing (non-share) log flow (search → quickLog) unaffected —
      not re-run on-device (would require re-provisioning the emulator). Confidence
      instead from: (a) `_layout.tsx`'s only change is purely additive — wraps the tree
      in `ShareIntentProvider` and calls `useShareIntentRouter()` unconditionally before
      `RootLayoutNav`'s early return (preserves hook order), touching no code in the
      search/quickLog/logVideoModal path; (b) the full regression suite stayed green
      throughout, including `logVideoModal`'s existing double-tap-creates-duplicate-log
      guard test; (c) `quickLog` itself was already exercised live via the share path in
      T5/T6, rendering the same component the search flow renders.
- Verify: ran every command above; see notes
- Files: `frontend/src/hooks/useShareIntentRouter.ts`,
  `frontend/src/hooks/__tests__/useShareIntentRouter.test.tsx`,
  `tasks/spec-share-to-app.md` (Success Criteria checked off) · Scope: XS

## Deferred — explicitly out of scope here

- [ ] **iOS Share Extension.** Needs its own spec (native extension target, App Group
      entitlement, Info.plist config, App Store review implications) — not started here.
- [ ] **YouTube Data API integration** for `duration`/`views`/`channel_url` at share-time.
      Only revisit if oEmbed's fields prove insufficient in practice (per spec decision 2).
