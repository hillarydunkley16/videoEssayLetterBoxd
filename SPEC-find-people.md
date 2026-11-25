# Spec: Search modes — Essays / People / Lists (+ Find People entry)

> Separate from `SPEC.md` (the Render deployment spec), which this does not replace.
> Status: **v3 — open questions answered; plan in `tasks/plan-find-people.md`.** No code written.
> v2: top-nav search bar gains **People** and **Lists** modes. v3: watchlist leaks fixed in scope (new module `collection-privacy`); decisions recorded below.

## Objective

1. From the empty following feed, **"Find people to follow"** opens people search.
2. The top-nav search bar (`SearchField`, shared by `WebNav` and `MobileTopNav`) gets three
   modes: **Essays** (today's behavior, default), **People**, **Lists**.
3. Lists search never returns anyone's **watchlist** (private).

**Users:** signed-in users, web first; native shares the same screen (Decision 1: mobile gets the modes too).

**Why:** the feed button currently does `router.push("/search")`, the *video essay* search.
There is no way to find a person or someone's list.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `people-search` | `GET /api/users/search/` + `searchUsers()` + shared `UserRow` | — |
| `collection-privacy` | Close the two existing watchlist leaks; provide the shared `public_collections()` queryset helper | — |
| `list-search` | `GET /api/collections/search/` + `searchCollections()` (watchlists excluded) | collection-privacy |
| `search-modes-ui` | `type` param, mode switch on the search screen, People/Lists result views, feed button target | people-search, list-search |

Build order: `people-search` and `collection-privacy` (independent) → `list-search` → `search-modes-ui`.
Kept in one file for review; each module section below is separately testable and shippable.

## Current state (verified in code)

- No user or list search endpoints. `GET /api/users/` is an unfiltered dump.
- `SearchField` (`components/ui/SearchField.tsx`) has no local results: it pushes `q`
  (every keystroke) and `submittedAt` (Enter) to `/(tabs)/search`; `SearchScreen` reads them
  with `useLocalSearchParams` and debounces its DB filter 250 ms. Placeholder is hardcoded
  "Search a video essay…". `SearchScreen` also carries `mode=log` (mobile Log tab).
- `FollowListUserSerializer` returns `{id, username, imageUrl, is_following}`; `username` is
  `Profile.display_username` (nullable, non-unique). `User.username` is the raw Clerk id —
  never shown or searched.
- `Collection` has `is_watchlist` and **no** public/private field: every non-watchlist list is
  effectively public. `CollectionSerializer` embeds full `essays`, `owner` (display name),
  `is_owner`.
- `SuggestedUsers` + `fetchSuggestedUsers` exist (max 5, unpaginated).
- DRF default pagination: `PageNumberPagination`, `PAGE_SIZE = 10`.

### Privacy findings (pre-existing; fixing is in scope — module `collection-privacy`)

- `GET /api/collections/` (`CollectionList`, `AllowAny`) returns **all** collections,
  **including every user's watchlist**, to anyone, signed in or not. Only caller:
  `app/(home)/popularLists.tsx` (discovery), which never needs a watchlist.
- `GET /api/collections/<uuid>/` (`CollectionDetail`) serves any collection to any signed-in
  user, so another user's watchlist is readable by UUID. Callers: `collectionInfo.tsx` (own
  watchlist and others' ordinary lists).
- **Related, not a read leak — approved for this work (Decision 7):** `CollectionDetail` is
  `RetrieveUpdateDestroyAPIView` with only `IsAuthenticated`, so any signed-in user can
  PUT/PATCH/DELETE **any** list by UUID. `IsOwnerOrReadOnly` already exists in
  `permissions.py` but this view doesn't use it. Note the separate `RemoveCollection` view
  is already owner-scoped, so the app UI doesn't hit this — but the API accepts it.
- Collections have no public/private field: every non-watchlist list is public by design.
  Adding one is out of scope.

## Behavior and acceptance criteria

**Modes / UI (`search-modes-ui`)**
1. The search screen shows a mode switch **Essays | People | Lists** under the bar. It is driven
   by a route param `type=essays|people|lists` (default `essays`; unknown values → `essays`), so
   it is linkable and survives reload. The switch lives on the screen, so `SearchField` only
   needs its placeholder to follow `type` ("Search a video essay…" / "Search people…" /
   "Search lists…").
2. Switching mode keeps the current `q` and re-queries. `Essays` behavior is unchanged
   (debounced DB filter, Enter runs YouTube). People/Lists never call SerpAPI.
3. "Find people to follow" navigates to `/search?type=people`. With empty `q` the People view
   shows **Suggested** users (`fetchSuggestedUsers`); Lists with empty `q` shows a prompt
   ("Search lists by name").
4. `mode=log` (mobile Log tab) is untouched and forces `Essays`.
5. A slow response for an earlier keystroke or earlier mode never overwrites a newer one.

**Privacy (`collection-privacy`)**
0a. `GET /api/collections/` never returns a watchlist (any viewer, anonymous included). It
    stays `AllowAny` for ordinary lists (Popular Lists is a discovery page).
0b. `GET /api/collections/<uuid>/` returns `404` for a watchlist unless the viewer owns it.
    Ordinary lists remain readable by any signed-in user. Own watchlist still works
    (`collectionInfo.tsx` shows it).
0c. One helper `public_collections()` (non-watchlist collections) is the single place the rule
    lives; `CollectionList` and `CollectionSearch` both use it.

**People (`people-search`)**
6. Case-insensitive substring match on `Profile.display_username`. Order: exact, prefix,
   most-followed, `id` (stable pagination). Viewer excluded. Null/blank `display_username`
   not searchable. `q` < 2 chars (trimmed) → empty page.
7. Row: avatar, username, Follow/Following button from `is_following`; toggle via `followUser`
   with a per-row busy guard; tap row → that user's profile.

**Lists (`list-search`)**
8. Case-insensitive substring match on `Collection.name` — **name only** (decided; not
   description, not owner). **`is_watchlist=True` rows are never returned, for any viewer, including the owner's
   own** (their watchlist is reached from Lists/Profile, not search). `q` < 2 chars → empty.
9. Order: exact, prefix, most essays, `id`. Response reuses `CollectionSerializer` fields so
   the existing list card renders; tap → `collectionDetail`. Includes the owner display name.
10. Empty and error states for both People and Lists: "No one found for 'x'" / "No lists
    match 'x'"; failures log and show an inline retry, never crash.

## API contracts

`GET /api/users/search/?q=&page=` — `ClerkAuthentication`, `IsAuthenticated`
```json
{ "count": 1, "next": null, "previous": null,
  "results": [{ "id": 7, "username": "filmfan", "imageUrl": "https://…", "is_following": false }] }
```

`GET /api/collections/search/?q=&page=` — `ClerkAuthentication`, `IsAuthenticated`
(**not** `AllowAny`, unlike `CollectionList`). Paginated; `results` are `CollectionSerializer`
objects. Queryset: `Collection.objects.filter(is_watchlist=False, name__icontains=q)` via
`with_collection_relations` (constant queries).

Both: missing/short `q` → `200` empty page; unauthenticated → `401`. No schema change, no
migration. Register both routes **before** any `<int:pk>` / `<uuid:public_id>` pattern.

## Commands

```
# Backend (from backend/; system python has no Django — use the venv)
.venv/bin/python manage.py test movie_csv.test_user_search movie_csv.test_list_search
.venv/bin/python manage.py test
.venv/bin/python manage.py makemigrations --check

# Frontend (from frontend/)
npx jest
npx tsc --noEmit
npm run lint
npx expo export --platform web
npx expo start --web
```

## Project Structure

```
backend/movie_csv/views/api.py                → UserSearch, CollectionSearch (beside SuggestedUsers / CollectionList)
backend/movie_csv/urls/api.py                 → users/search/, collections/search/
backend/movie_csv/test_user_search.py         → new
backend/movie_csv/test_list_search.py         → new
backend/movie_csv/test_collection_privacy.py  → new (leak fixes)
frontend/src/api/users.ts                     → searchUsers()
frontend/src/api/collection.ts                → searchCollections()
frontend/src/screens/SearchScreen.tsx         → read `type`, mode switch, render per mode
frontend/src/screens/PeopleResults.tsx        → People view (uses UserRow)
frontend/src/screens/ListResults.tsx          → Lists view (uses existing list card)
frontend/src/screens/UserRow.tsx              → extracted from FollowListScreen
frontend/components/ui/SearchField.tsx        → placeholder follows `type`; preserve `type` when pushing q
frontend/src/screens/FollowingFeedScreen.tsx  → button → /search?type=people
```

## Code Style

Match `SuggestedUsers`; pass the token into `src/api/*`; build URLs only through `client.ts`.
One queryset helper, `public_collections()`, holds the watchlist rule; search and the list endpoint both use it.

## Testing Strategy

- **Backend (tests first, one file per concern):**
  - people: substring/case; ordering; viewer excluded; null display name excluded;
    `is_following`; short `q` → empty; `%`/`_` literal; 401; stable pagination;
    `assertNumQueries` constant.
  - privacy: list endpoint has no watchlist for anonymous / other / own viewer; detail returns
    404 for another user's watchlist and 200 for own; ordinary lists unchanged; existing
    `test_collection_owner.py` and `test_watchlist.py` stay green (update only where they
    assumed the leak, and say so in the commit).
  - lists: substring/case on name; **watchlist never returned** (someone else's *and* the
    viewer's own; also a legacy-named "<clerk id>'s Watchlist" row flagged `is_watchlist`);
    ordinary lists returned; 401 (not anonymous); owner shown as display name, never the Clerk
    id; constant queries; short `q` → empty.
- **Frontend (jest-expo):** `type` param selects the view and unknown value falls back to
  essays; switching mode preserves `q`; debounce; stale-response drop across keystroke *and*
  mode change; People follow toggle + busy guard; Lists tap → detail; empty/error states;
  `mode=log` still opens quick log. Existing search and `FollowListScreen` tests still pass.
- **Manual (`expo start --web`):** type in the nav bar in each mode; feed empty-state button →
  People; create a watchlist item and confirm the watchlist never appears in Lists search.
- Gates: backend suite, jest, `tsc --noEmit`, `expo lint`, `expo export --platform web`
  (no new errors vs baseline).

## Boundaries

- **Always:** tests before endpoints; exclude the viewer (people) and watchlists (lists); use
  `display_username` only; `select_related`/`prefetch_related` (no N+1); require auth on both
  new endpoints.
- **Ask first:** adding a dependency; a DB index or `pg_trgm` (migration); changing
  `FollowListUserSerializer` or `CollectionSerializer` fields; adding a real public/private
  field to `Collection`; (owner-only writes on `CollectionDetail` is approved — Decision 7).
- **Never:** search or return `User.username` (Clerk id), email or other PII; return any
  watchlist from search; make the lists search endpoint anonymous; edit applied migrations;
  return unbounded results; skip failing tests.

## Success Criteria

- Acceptance criteria 1–10 hold via the tests and manual flow above.
- A watchlist is provably absent from Lists search (dedicated test, both owners).
- Essays search behaves exactly as before (existing tests green).
- Both endpoints run a constant number of queries; no new `tsc`/lint errors; web export builds.

## Decisions (from review)

1. Mode switch is on the shared search screen → **mobile gets it too**.
2. Empty People input shows **Suggested** users.
3. Minimum query length **2**.
4. People without `display_username` are unsearchable **for now**. **Tracked issue to address
   later** — every user should have a username (see `tasks/todo-find-people.md` follow-ups and
   `tasks/todo-display-username.md`). Until then, searchers get no result for them.
5. **Fix the watchlist leaks in this work** (`collection-privacy`).
6. Lists search matches **names only**.

7. **Owner-only writes on `CollectionDetail` are in scope** (task T3, `IsOwnerOrReadOnly`).

## Open Questions

None.
