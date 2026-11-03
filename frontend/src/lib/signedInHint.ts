// Browser-only hint that this visitor was signed in last time, so the home route can show a
// feed skeleton instead of the marketing hero while Clerk loads. It is only a hint (Clerk
// decides who is signed in) and holds just a flag, no user data. Storage can be missing or
// throw (private windows, blocked site data), so every access is guarded.
const KEY = 'watchd:signed-in-hint';

export function hasSignedInHint(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setSignedInHint(): void {
  try {
    globalThis.localStorage?.setItem(KEY, '1');
  } catch {
    // Hint only: ignore.
  }
}

export function clearSignedInHint(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Hint only: ignore.
  }
}
