import { ScrollViewStyleReset } from 'expo-router/html';
import { Colors } from '@/constants/theme';

const { light, dark } = Colors;

// react-native-web serializes the hex theme colors inline as rgba(r,g,b,1.00).
const rnwRgba = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},1.00)`;
};

// Inline so the first paint is already themed. The web useColorScheme is `light` until
// hydration, so the statically exported shell carries the light palette inline; in dark
// mode the attribute selectors recolor it (inline styles need !important) until hydration
// swaps in the real values. Built from Colors so it can't drift from the theme.
const criticalCss =
  `body{background-color:${light.background};color:${light.text}}` +
  '@media (prefers-color-scheme: dark){' +
  `body{background-color:${dark.background};color:${dark.text}}` +
  `[style*="background-color:${rnwRgba(light.background)}"]{background-color:${dark.background}!important}` +
  `[style*="background-color:${rnwRgba(light.surface)}"]{background-color:${dark.surface}!important}` +
  `[style*="color:${rnwRgba(light.text)}"]{color:${dark.text}!important}` +
  `[style*="border-top-color:${light.border}"]{border-color:${dark.border}!important}` +
  '}';

// Web-only document shell. Fraunces/Inter are loaded here via Google Fonts
// instead of expo-font, matching how the design-system mockup pulls them.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap"
        />
        <style id="critical-theme" dangerouslySetInnerHTML={{ __html: criticalCss }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
