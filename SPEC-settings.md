# Spec: Settings Page (reachable from Profile)

> Separate from `SPEC.md` (the Render deployment spec), which this does not replace.
> Status: **DRAFT — awaiting approval.** No code written.

## Objective

Give signed-in users one place for account actions — **sign out, change password, change
profile picture, delete account** — reached from a **gear icon in the own-profile header**.

**Users:** signed-in users on web and native (same expo-router screen, no platform branching
beyond what Clerk components require).

**Decisions already made:** file is `SPEC-settings.md`; contents = all four actions;
approach = thin page composed of Clerk components/hooks (not fully custom flows); entry =
gear icon in the profile header, own profile only.

**Current state (verified in code):**
- `app/(tabs)/settings.tsx` is a comments-only stub (no component, no default export);
  nothing links to it. Its comment notes Clerk's `UserButton` may replace custom settings.
- `ProfileScreen.tsx` header (`styles.topbar`) has a text "Sign out" `TouchableOpacity` →
  `handleSignOut` (`signOut()` then `router.replace("/")`).
- Profile photo change already exists on the profile avatar (`handleChangePhoto`:
  ImagePicker → `user.setProfileImage` → `updateProfileImageAPI`).
- `components/ui/SignOutButton.tsx` and `app/components/sign-out-button.tsx` both exist.
- **No backend endpoint deletes an account.** `movie_csv/urls/api.py` has only log/like/
  collection deletes. `authentication.py` lazily creates `User`/`Profile` on first sight of
  a Clerk `sub`.
- `@clerk/clerk-expo ^2.19.20`. Prebuilt `UserProfile`/`UserButton` UI is web-oriented;
  native support must be verified against the installed version before relying on it.

## Tech Stack

Expo / expo-router / React Native, `@clerk/clerk-expo` (hooks: `useUser`, `useClerk`,
`useAuth`), Django/DRF backend (only if account deletion needs server cleanup).

## Scope by action

| Action | Implementation | Backend? |
|---|---|---|
| Sign out | Move from profile header to settings; reuse `SignOutButton`; `router.replace("/")` | No |
| Change password | `user.updatePassword({currentPassword, newPassword})` in a small form (prebuilt UI only if it works on native) | No |
| Change profile picture | Reuse `handleChangePhoto` logic (extract to a shared helper, don't duplicate); keep avatar tap on profile working | Existing `updateProfileImageAPI` |
| Delete account | Confirmation step (type username or explicit confirm dialog) → `user.delete()` | **Yes — see Open Questions** |

## Commands

```
cd frontend
npx expo start --web            # dev
npx tsc --noEmit                # typecheck
npm run lint                    # expo lint
npm test                        # jest (jest-expo)
npx jest app/\(tabs\)/__tests__/settings.test.tsx   # single file
npx expo export --platform web  # build gate
cd ../backend && python manage.py test              # only if backend touched
```

## Project Structure

```
frontend/app/(tabs)/settings.tsx          → thin route wrapper (default export Page), renders SettingsScreen
frontend/src/screens/SettingsScreen.tsx   → screen implementation
frontend/src/screens/ProfileScreen.tsx    → header: swap "Sign out" text for gear → router.push("/(tabs)/settings")
frontend/app/(tabs)/_layout.tsx           → register settings Stack.Screen (headerShown: false)
frontend/app/(tabs)/__tests__/            → settings tests
backend/movie_csv/test_account_delete.py  → only if a delete endpoint is added
```

## Code Style

Match `ProfileScreen`: themed colors from `theme`, `Fonts?.sans*`, `TouchableOpacity` with
`accessibilityLabel`, `router.push` with typed paths, errors logged via `console.error` and
surfaced inline.

```tsx
<TouchableOpacity onPress={() => router.push("/(tabs)/settings")} accessibilityLabel="Settings">
  <IconSymbol name="gearshape" size={20} color={theme.muted} />
</TouchableOpacity>
```

Route components PascalCase-named; no hardcoded backend URL (use `src/api/client.ts` only).

## Testing Strategy

Frontend gates are `tsc --noEmit`, `expo lint`, `expo export --platform web` plus focused
jest tests (jest-expo, mocking `@clerk/clerk-expo` and `expo-router`), following the existing
Prove-It pattern:
- ProfileScreen own-profile shows gear; tapping pushes `/(tabs)/settings`. `otherProfile`
  shows no gear.
- Settings: Sign out calls `signOut` then `router.replace("/")`.
- Password form: calls `updatePassword` with entered values; shows Clerk error message on
  failure; blocks submit on empty/mismatched confirm.
- Delete: button does nothing until confirmed; confirmed calls the delete path and then
  routes signed-out.
- Manual check in browser (web) for the Clerk-component pieces; native check noted as
  untested if not run.

## Boundaries

- **Always:** keep Clerk as the auth source of truth; confirm destructive actions; put
  settings behind sign-in; run tsc/lint/tests before commit; add new migrations rather
  than editing applied ones.
- **Ask first:** adding dependencies; adding a backend endpoint or changing models;
  changing Clerk dashboard config (e.g., enabling self-deletion); moving/removing the
  avatar-tap photo change.
- **Never:** hardcode Clerk issuer/host/secrets; log passwords/tokens; delete Django data
  without the Clerk deletion succeeding first (or without a defined order); touch the
  commented-out `WatchList`/`display_username` code.

## Success Criteria

1. Own-profile header shows a gear (accessible label "Settings"); it navigates to settings.
   Other users' profiles do not show it.
2. Settings page is reachable, has a working back path, and no longer a stub.
3. Sign out from settings signs out and lands on `/`; the old header "Sign out" is removed.
4. Change password succeeds with correct current password; wrong password shows an error.
5. Change photo from settings updates the avatar and `Profile.imageUrl`; avatar tap on
   profile still works.
6. Delete account requires explicit confirmation, deletes the Clerk user, leaves no
   orphaned data problem (per Open Question decision), and signs the user out.
7. `tsc --noEmit`, `expo lint`, `expo export --platform web`, and `npm test` pass.

## Open Questions

1. **Delete account — data handling.** No server endpoint exists. Options:
   (a) `user.delete()` on client only; Django `User`/`Profile`/logs remain orphaned (a
   later sign-in never recreates the same `sub`); (b) new authenticated
   `DELETE /api/account/` that removes the Django `User` (cascade logs/likes/comments/
   collections) *then* client calls `user.delete()`; (c) Clerk webhook `user.deleted`.
   Recommendation: **(b)**. Needs your call, and it's a backend addition.
2. **Clerk self-deletion** must be enabled in the Clerk dashboard for `user.delete()` to
   work — confirm you'll enable it (dev instance).
3. **Native prebuilt UI:** if `UserProfile` isn't supported on native in v2.19, the
   password form is custom (as specified above). Confirm that fallback is fine.
4. **Users who signed in via OAuth** have no password; hide/disable Change password when
   `user.passwordEnabled` is false?
5. Should the standalone `app/components/sign-out-button.tsx` duplicate be removed?
   (Out of scope unless you say so.)
