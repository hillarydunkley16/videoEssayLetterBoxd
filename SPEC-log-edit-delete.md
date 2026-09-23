# Spec: Edit & Delete Your Own Logs on the Log Page

## Objective

On an individual log page (`app/(modals)/singleLog.tsx` → `src/screens/logInfo.tsx`), the
signed-in user can **edit** or **delete** a log they created. Other users' logs show no such controls.

**Users:** beta testers who want to fix a rating/review typo or remove a log without going back to Profile.

**Already in place (don't rebuild):**
- Backend `logDetail` (`RetrieveUpdateDestroyAPIView`) at `PATCH/PUT/DELETE /api/logList/<uuid>/` and `DeleteLog` at `DELETE /api/logList/<uuid>/delete`, both gated by `IsOwnerOrReadOnly` (F0 security fix, covered by `test_owner_permissions.py`).
- `LogSerializer.is_mine` tells the client whether the viewer owns the log; `logInfo.tsx` already reads it (`isMine`).
- `deleteLog()` in `src/api/logs.ts` + `useAuthDelete`; `useAuthUpdate` (PATCH) exists but has no log caller.
- Profile already delete-with-confirmation (commit 764e872).

**Missing:** no UI on the log page; no `updateLog` client function; `LogSerializer.essay` is writable, so a PATCH could currently re-point a log to a different essay.

### Acceptance criteria
1. Owner sees a top-right three-dots menu with **Edit** and **Delete** on their log page; non-owners see neither.
2. **Edit** (via the three-dots menu, reopening `logVideoModal` pre-filled) lets the owner change rating (0–5), review text (≤200 chars), date, and rewatch. On save the page shows the updated values without a manual reload.
3. **Delete** asks for confirmation (same pattern as Profile), then deletes and navigates back (`router.back()`, fallback to Profile tab if no history).
4. Double-tap on Save/Delete does not send duplicate requests (see the Prove-It test for `logVideoModal`).
5. Backend ignores `essay` and `owner` in edits (fixed after creation) and still returns 403 for non-owners, 404 for missing logs.
6. Errors (network, 403/404) show an inline message; the form/page stays usable.

## Tech Stack
Django + DRF (`ClerkAuthentication`), Expo/React Native + expo-router, `@clerk/clerk-expo`, axios hooks in `src/api/`, jest-expo.

## Commands
```
# backend (from backend/)
python manage.py test movie_csv.test_log_edit
python manage.py test movie_csv.test_owner_permissions
python manage.py test
# frontend (from frontend/)
npx tsc --noEmit
npm run lint
npx jest src/screens/__tests__/logInfo.test.tsx
npx expo export --platform web
```

## Project Structure
```
backend/movie_csv/serializers.py       → make `essay` read-only on update
backend/movie_csv/views/api.py         → logDetail (no new endpoint expected)
backend/movie_csv/test_log_edit.py     → NEW per-concern test file
frontend/src/api/logs.ts               → add updateLog()
frontend/src/screens/logInfo.tsx       → three-dots menu, delete confirm
frontend/app/(modals)/logVideoModal.tsx → accept an existing log to prefill; PATCH instead of POST
frontend/src/screens/__tests__/        → logInfo tests
```

## Code Style
Match neighbours: 2-space TS, hooks at top of component, API helpers take the auth hook as an argument.
```ts
export async function updateLog(
  id: string,
  payload: UpdateLogPayload,
  authUpdate: ReturnType<typeof useAuthUpdate>,
): Promise<Log> {
  const response = await authUpdate(`/api/logList/${id}/`, payload);
  return response.data;
}
```
Backend tests: `APIRequestFactory` + `force_authenticate`, as in `test_owner_permissions.py`.

## Testing Strategy
- **Backend (TDD):** owner PATCH updates rating/review/date/rewatch; owner PATCH with a different `essay` leaves essay unchanged (200); non-owner PATCH/DELETE → 403; rating outside 0–5 → 400; owner DELETE → 204.
- **Frontend (jest-expo):** owner sees Edit/Delete, non-owner doesn't; delete requires confirm; double-tap Save sends one request.
- **Gates:** `tsc --noEmit`, `expo lint`, `expo export --platform web`, full Django suite. Manual check on web + iOS sim.

## Boundaries
- **Always:** enforce ownership server-side (UI hiding is cosmetic); add a failing test first; use `authFetch`/auth hooks (backend URL only via `client.ts`); confirm before delete.
- **Ask first:** new dependencies; model/migration changes (e.g. an `edited_at` field); a new endpoint; changing Profile's delete flow.
- **Never:** let PATCH change `owner`/`essay`; edit applied migrations; remove/skip existing tests; hardcode hosts or secrets.

## Success Criteria
All six acceptance criteria hold; new backend + frontend tests pass; existing suites unchanged; gates green.

## Decisions (resolved)
1. **Edit UX:** reopen `logVideoModal` pre-filled with the log's rating, review, date, rewatch; submit PATCHes instead of POSTing. Essay is fixed.
2. **Editable fields:** rating, review text, date, rewatch.
3. **No "edited" marker** (no migration).
4. **Essay/owner in a PATCH are silently ignored** (read-only serializer fields, no 400).
5. **After delete:** `router.back()` to the previous screen.
6. **Styling:** a three-dots (vertical/horizontal ellipsis) button in the top right of the log page, owner only; tapping opens a menu with **Edit** and **Delete**. Delete still confirms.
7. **Menu form:** one shared in-app popover used identically on web, iOS and Android (no platform-specific action sheets).
8. **Cascade delete:** deleting a log also deletes its comments and likes (existing model behavior); accepted.

## Open Questions
None.
