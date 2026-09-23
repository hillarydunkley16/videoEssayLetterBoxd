// expo-share-intent's own hook (useShareIntent) reads the share-intent launch URL
// independently via expo-linking's useLinkingURL() -- it doesn't depend on this
// router-level redirect to actually resolve a share. This redirect exists only to
// avoid expo-router showing "Unmatched Route" for a URL shape (`<scheme>://dataUrl=`)
// that was never meant to be a route in the first place.
export async function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.includes('dataUrl=')) {
    return '/';
  }
  return path;
}
