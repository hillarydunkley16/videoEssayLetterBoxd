# Spec: Share-to-App (YouTube Share Sheet → Start a Log)

Branch: `v2`. Single capability (share intent capture → get-or-create essay → log flow) —
no capability map needed.

## Objective

Let a user, while watching a video essay in the YouTube app, tap "Share" and select
Visual Arguments from the OS share sheet. The app opens (or comes to foreground) with
that video already resolved, and drops the user straight into the existing quick-log
flow (`(modals)/quickLog`) for it — no manual search required.

**Scope for this spec: Android only.** iOS requires a separate native Share Extension
target (its own Info.plist entries, App Group entitlement, extension UI) which is
enough additional native-build surface to warrant its own follow-up spec once the
Android path is proven. Everything below (backend endpoint, get-or-create logic,
pending-share/resume-after-sign-in handling) is written to be iOS-reusable later —
only the OS-registration piece changes.

**Success looks like:** sharing a YouTube video URL from the YouTube Android app to
Visual Arguments lands the user in `quickLog` with the correct title/thumbnail
populated, ready to rate, within one app launch — including when the user isn't
signed in yet.

## Decisions (confirmed)

1. **Platform**: Android first, via an intent filter — no custom native module beyond
   what `expo-share-intent`'s config plugin provides. Requires EAS Build / a custom
   dev client; this feature cannot be tested in Expo Go.
2. **Metadata source**: YouTube oEmbed (`https://www.youtube.com/oembed?url=...&format=json`)
   — free, unauthenticated, gives `title`, `author_name` (→ `channel_name`), and
   `thumbnail_url`. `duration`, `views`, `channel_url` stay null on creation, consistent
   with `VideoEssay`'s existing nullable fields; they get filled in later if/when the
   same video is found via the existing SerpAPI search flow.
3. **Duplicate handling**: get-or-create by `youtube_id` on the backend. `VideoEssay.youtube_id`
   already has a `unique=True` constraint (`backend/movie_csv/models.py:13`), so this is
   enforced at the DB level regardless — the new endpoint just needs to look up before
   inserting rather than relying on the constraint to reject a duplicate POST.
4. **Signed-out share**: the shared `youtube_id` is held (see Pending Share, below), the
   user is routed through the existing Clerk sign-in/up flow, and on successful auth
   they're sent to `quickLog` for that video — same as if they'd shared it while
   already signed in.

## Tech Stack / New Dependencies

- `expo-share-intent` (new) — Android share-intent config plugin + JS hook
  (`useShareIntentContext`). Adds a config plugin entry to `frontend/app.json`.
- No new backend dependencies — oEmbed is a plain HTTP GET, no SDK needed
  (`requests`, already a transitive dependency via other libs, or Python's stdlib
  `urllib` — confirm which is already vendored during Plan).

## Commands

Same as existing project commands (`CLAUDE.md`) — no new command surface. One addition:
after wiring the config plugin, local testing requires a dev-client rebuild:

```
cd frontend
npx expo prebuild --platform android      # regenerate native project with the plugin
eas build --profile development --platform android   # or local: npx expo run:android
```

Existing dev/test/lint commands (`npx expo start`, `npm run lint`, `npx tsc --noEmit`,
`npx jest`, backend `python manage.py test`) all still apply unchanged.

## Project Structure (additions only)

```
backend/movie_csv/
  services/youtube_oembed.py     → new: fetch title/author/thumbnail by youtube_id
  views/api.py                   → new endpoint: get-or-create VideoEssay by youtube_id
  test_video_essay_from_share.py → new test file (per-concern, matches existing pattern)

frontend/
  app.json                       → expo-share-intent config plugin entry
  app/_layout.tsx                → share-intent listener, routes to quickLog or sign-in
  src/api/videos.ts              → new function: getOrCreateVideoEssayByYoutubeId
  src/lib/shareIntent.ts         → new: parse youtube_id out of a shared URL,
                                     hold/read the "pending share" across the sign-in
                                     redirect (e.g. via a small in-memory/SecureStore-backed
                                     store, resolved during Plan)
```

## Code Style

Existing conventions apply — flat `views/api.py` (no viewsets-per-file), per-concern
backend test files, thin `app/**` route wrappers delegating to `src/screens/`. Example
of the shape the new backend view should take, matching neighbors like `VideoEssayCreateView`
(`backend/movie_csv/views/api.py:460`):

```python
class VideoEssayFromYoutubeId(generics.GenericAPIView):
    serializer_class = VideoEssaySerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        youtube_id = request.data.get("youtube_id")
        essay, created = VideoEssay.objects.get_or_create(
            youtube_id=youtube_id,
            defaults=fetch_oembed_metadata(youtube_id),
        )
        return Response(VideoEssaySerializer(essay).data, status=201 if created else 200)
```

## Testing Strategy

- **Backend**: new `movie_csv/test_video_essay_from_share.py` — covers (a) creating a
  fresh `VideoEssay` from a valid youtube_id via a mocked oEmbed response, (b) returning
  the existing row on a repeat call with the same youtube_id (no duplicate, no second
  oEmbed call), (c) a malformed/invalid youtube_id or an oEmbed 404 returning a clean
  4xx rather than a 500, (d) anonymous POST rejected (`IsAuthenticated`, matching the
  rest of the write-side API). Mock the oEmbed HTTP call — no real network calls in tests.
- **Frontend**: unit test for the youtube-ID-from-shared-URL parser (`shareIntent.ts`)
  covering `youtu.be/...`, `youtube.com/watch?v=...`, and a share text that also includes
  surrounding message text (YouTube's share sometimes appends a title before the URL).
  No end-to-end share-sheet test — that requires a real device/OS share sheet, out of
  reach of `jest-expo`; verify that path manually on a dev-client build during Implement.
- Existing gates (`npx tsc --noEmit`, `npm run lint`, `npx expo export --platform web`,
  `python manage.py test`) must stay green — `expo export --platform web` in particular
  confirms the share-intent plugin doesn't break the web build (share intents are a
  no-op on web; the hook should degrade to nothing there, not throw).

## Boundaries

- **Always do**: keep `IsAuthenticated` on the new endpoint (matches every other
  write-side view); reuse `VideoEssay.youtube_id`'s existing unique constraint rather
  than adding a new one; keep `frontend/src/api/client.ts` as the only place the backend
  URL is resolved (no bypassing it for the oEmbed call — that call is server-side only).
- **Ask first**: adding the real YouTube Data API (a second, paid/quota'd credential)
  if oEmbed's limited fields prove insufficient later; any change to `app.json`'s
  `scheme` or bundle identifier; committing a `google-services.json` or similar Android
  config file if `expo-share-intent`'s setup ends up requiring one.
- **Never do**: call oEmbed (or any third-party metadata fetch) from the frontend
  directly — it goes through the backend like the existing SerpAPI search does, so API
  shape/error handling stays centralized and testable; never store the pending shared
  video in a way that survives past a single sign-in redirect (no need for it to
  persist across app restarts).

## Success Criteria

- [x] Sharing a YouTube video URL from the YouTube Android app to Visual Arguments
      opens the app and lands on `quickLog` for that exact video within one launch.
      Verified via the OS-level `ACTION_SEND`/`text/plain` intent (the same mechanism
      a real YouTube share-sheet tap sends) on a local Android emulator — see T5/T6.
- [x] If the video's `youtube_id` already exists as a `VideoEssay`, the existing row
      (and its `public_id`) is reused — no duplicate row created. Covered by
      `test_video_essay_from_share.py` (asserts no second oEmbed call on a repeat POST).
- [x] If the video is new, a `VideoEssay` is created with `title`, `thumbnail`, and
      `channel_name` populated from oEmbed; `duration`/`views`/`channel_url` remain
      null (all three are `null=True` on the model and are never passed by the
      get-or-create view), matching the model's existing nullable-field pattern.
- [x] A signed-out user who shares a video is taken through sign-in/up and then lands
      on `quickLog` for that same video, without having to re-share or re-search.
      Verified live on-device (T6): shared while signed out, signed in, landed on
      `quickLog` automatically.
- [x] An invalid/deleted video (oEmbed 404) shows a clean error, not a crash or a blank
      `quickLog` screen. Backend returns 422 (`test_video_essay_from_share.py`); found
      during T7 that the frontend hook had no catch for this and would silently do
      nothing — fixed to show `Alert.alert` instead (commit `ef08fb3`).
- [x] `expo export --platform web`, `tsc --noEmit`, `npm run lint`, `npx jest`, and
      `python manage.py test` all stay green. All five re-run for T7: backend 298/298,
      frontend jest 187/187, `tsc`/`lint` show only pre-existing issues unrelated to
      this feature's files, `expo export --platform web` succeeds.
- [x] Manually verified on an Android dev-client build (Expo Go cannot test this).
      Done in T5/T6; see their notes in `tasks/todo-share-to-app.md`.

## Open Questions

1. **`fetch_oembed_metadata` failure handling in `get_or_create`**: Django's
   `get_or_create` calls `defaults` eagerly even on a cache-hit-adjacent race; need to
   confirm in Plan whether to look up first (`filter().first()`) and only call oEmbed
   on an actual miss, to avoid a wasted HTTP call on the common "already exists" path.
2. **Pending-share storage mechanism** for the signed-out case: in-memory module state
   (fine if the sign-in redirect keeps the JS runtime alive) vs. `expo-secure-store`
   (already a dependency, per `app.json`'s plugin list) if the OS can kill/relaunch the
   app during the Clerk sign-in web view. Needs a quick spike during Plan.
3. **iOS follow-up**: explicitly out of scope here; flagging so it isn't assumed done.
