// Browser-only hint that this visitor was signed in last time, so the home route can show a
// feed skeleton instead of the marketing hero before the first paint (see the inline script in
// app/+html.tsx, which reads the same key). It is only a hint (Clerk decides who is signed in)
// and holds just a flag, no user data. Storage can be missing or throw (private windows,
// blocked site data), so every access is guarded.
export const SIGNED_IN_HINT_KEY = 'watchd:signed-in-hint';

export function setSignedInHint(): void {
  try {
    globalThis.localStorage?.setItem(SIGNED_IN_HINT_KEY, '1');
  } catch {
    // Hint only: ignore.
  }
}

export function clearSignedInHint(): void {
  try {
    globalThis.localStorage?.removeItem(SIGNED_IN_HINT_KEY);
  } catch {
    // Hint only: ignore.
  }
}
