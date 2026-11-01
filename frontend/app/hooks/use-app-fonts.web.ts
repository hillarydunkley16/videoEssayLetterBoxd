// Web loads Fraunces/Inter via the self-hosted @font-face in app/+html.tsx. Importing the
// @expo-google-fonts TTFs here would make Expo emit a `preload as=font` link for
// each one in every exported page, so web gets this stub instead of use-app-fonts.ts.
export function useAppFonts(): { loaded: boolean; error: Error | null } {
  return { loaded: true, error: null };
}
