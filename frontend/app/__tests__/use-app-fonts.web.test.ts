/**
 * Web font loading.
 *
 * Web gets Fraunces/Inter from the stylesheet in app/+html.tsx, so its useAppFonts must not
 * import the @expo-google-fonts TTFs (Expo turns those imports into `preload as=font` links
 * in every exported page, competing with the HTML/CSS for bandwidth).
 */
import { useAppFonts } from '../hooks/use-app-fonts.web';

describe('useAppFonts (web)', () => {
  it('reports fonts as loaded without loading any font files', () => {
    expect(useAppFonts()).toEqual({ loaded: true, error: null });
  });
});
