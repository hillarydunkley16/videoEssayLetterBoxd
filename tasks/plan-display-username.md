# Implementation Plan: Show Clerk usernames for other users

Spec: `SPEC-display-username.md`. Task list: `tasks/todo-display-username.md`.
(Separate from `tasks/plan.md`, which still holds the unfinished deploy plan.)

## Overview

The backend stores the Clerk `sub` as `User.username`, so other users appear as raw IDs. Capture the Clerk username from a session-token claim into `Profile.display_username`, then return it everywhere a user's name is shown: follow lists, suggested users, other-user profile, log/comment owners, collection owners. Users with no stored username show **"Anonymous"** (decision 2026-09-21). `User.username` never changes.

## Decisions (from spec review)

- Display **Clerk username**, not first/last name.
- No username → `"Anonymous"` (not the raw ID).
- Log, comment, and collection owners are **in scope**.
- No unique constraint on `display_username` (Clerk enforces uniqueness; a DB constraint could block login).
- Existing response keys stay (`username`, `owner`, `user`); only their values change, so frontend types don't change.

## Dependency graph

```
Clerk `username` claim (manual)
   └── Profile.display_username + migration
          └── auth capture (authentication.py)
                 └── display_username(user) helper  ──┬── follow lists + suggested users   (T2)
                                                       ├── other-user profile               (T3)
                                                       ├── log + comment owners + is_mine   (T4)
                                                       └── collection owners + is_owner     (T5)
                                                                    └── frontend sweep + gates (T6)
auth capture (T1) + CLERK_SECRET_KEY ──> backfill command (T7, independent of T2-T6, ship before/with deploy)
```

T2–T5 all depend on T1 and are independent of each other after it; ordered by user-visible value and risk.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **"Anonymous" until backfill.** Rows only get a username when that user next makes an authenticated request. Deploying before users re-auth shows many "Anonymous". | Med | Enable the Clerk claim first; deploy; expect names to fill in as beta users open the app. Consider a one-off management command later if it lingers. |
| **`collectionInfo.tsx:63` compares `collection.owner === user.id`** (Clerk `useUser` id, which equals the backend `username`). Changing `CollectionSerializer.owner` to a display name breaks the owner check (hides edit/delete). | High | T5 adds a viewer-relative `is_owner` boolean (`request.user == obj.owner`, like `is_following`) and the screen uses it. `get_watchList` must pass `context=self.context`; no request → `False`. Do **not** expose the Clerk `sub` as a separate field. |
| Claim name/config wrong → `display_username` never set. | High | T1 starts by decoding a real token. |
| N+1 queries: LogSerializer/CommentSerializer/CollectionSerializer now touch `profile` per row. Only `FollowingFeed` already uses `select_related("owner__profile")`. | Med | Add `select_related`/`prefetch_related` in each view; assert constant query counts in tests. |
| `ProfileSerializer.get_watchList` builds `"<user.username>'s Watchlist"` and `get_or_create`s by that name; `RemoveCollection` blocks deletes via `"Watchlist" in collection.name`; the backend never sets `is_watchlist` (frontend sets it client-side). | Med | **Leave untouched.** Renaming would create duplicate watchlists and could break delete protection. Follow-up ticket (out of scope): data migration setting `is_watchlist=True` on rows named `*'s Watchlist` and renaming to "Watchlist", `get_watchList` looking up by the flag, `RemoveCollection` checking the flag. |
| Pre-existing bug: `logInfo.tsx:133` `isMine = log.owner_id === parseInt(user?.id)`; Clerk ids are strings like `user_2abc`, so `parseInt` is `NaN` and `isMine` is always false (own logs never show "You"). | Low | Fix in T4 with a viewer-relative `is_mine` boolean on `LogSerializer`. Two call sites build `LogSerializer` without a request (VideoInfo, `views/api.py:185`); pass `context={"request": request}` there. Call out the behavior change in the PR. |
| `SuggestedUsers` draws from all users, so inactive users (never re-authed since the claim) show as "Anonymous" in People to follow. | Med | T7: idempotent backfill command using Clerk Backend API `getUserList` (limit ≤ 500 + offset). Needs `CLERK_SECRET_KEY`, set only in the Render shell for the one run (not in `render.yaml`). |
| Custom claims share a ~1.2KB cookie budget with Clerk's defaults; `imageUrl` + `email` already use some. Unset-username shortcode value is unconfirmed (empty/null/missing). | Low | T0 checks the token still issues. T1 treats empty, null, and missing claim identically: never overwrite. Claims can lag up to 60s; fine here. |

## Task list

### Phase 1: Capture
- [ ] T0: Clerk claim + confirm claim name (manual)
- [x] T1: Store the username on first/next auth

### Checkpoint: Capture
- [ ] `test_authentication` green; a real token yields `display_username`

### Phase 2: Show it (backend slices, each user-visible)
- [x] T2: Follow lists + suggested users
- [x] T3: Other-user profile

### Checkpoint: Follow surface
- [ ] People to follow / followers / following / other profile show usernames in the running app

### Phase 3: Owners
- [x] T4: Log and comment owners (+ `is_mine`)
- [x] T5: Collection owners (+ `is_owner`)

### Phase 4: Verify + backfill
- [x] T6: Frontend sweep + full gates
- [ ] T7: Backfill command for users who haven't re-authed

### Checkpoint: Complete
- [ ] All spec success criteria met; ready for review

## Resolved

- `user` on `collectionInfo.tsx` is Clerk `useUser()`; its id is the Clerk `sub` (= backend `username`). T5 uses `is_owner`.
- Backfill: T7 command (approved 2026-09-21), includes the `CLERK_SECRET_KEY` ask.

## Out of scope (follow-up ticket)

- Watchlist naming/`is_watchlist` cleanup (see Risks).

## Open questions

- Does `{{user.username}}` yield empty, null, or nothing for users without a username? Handled either way in T1; confirm in T0.
