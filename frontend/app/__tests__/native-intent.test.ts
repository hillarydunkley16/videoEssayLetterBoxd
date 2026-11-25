/**
 * expo-router calls redirectSystemPath before routing when the app is launched/
 * foregrounded by an external URL. expo-share-intent's own hook (useShareIntent)
 * reads that same URL independently via expo-linking's useLinkingURL() — it does
 * not depend on the router successfully matching a route. So without this redirect,
 * a share-intent launch URL (`<scheme>://dataUrl=...`) has no matching route and
 * expo-router shows "Unmatched Route" — a real bug observed live on iOS Simulator
 * (T4 verification), even though the share itself would still resolve correctly
 * behind that screen.
 */
import { redirectSystemPath } from '../+native-intent';

it('redirects an expo-share-intent dataUrl launch to home instead of leaving it unmatched', async () => {
  const result = await redirectSystemPath({
    path: 'frontend://dataUrl=frontendShareKey?nonce=96D61889-35B1-449C-B9BC-DDC3B501B46F',
    initial: true,
  });
  expect(result).toBe('/');
});

it('leaves a normal route path untouched', async () => {
  const result = await redirectSystemPath({ path: '/(tabs)/search', initial: false });
  expect(result).toBe('/(tabs)/search');
});
