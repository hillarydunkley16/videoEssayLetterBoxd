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

// Self-hosted Latin/Latin-Extended woff2 subsets of the weights the app uses (served from
// frontend/public/fonts). The -vN suffix is part of the name because /fonts/* is cached
// immutably: bump it when a file changes.
const FONT_FACES = [
  { family: 'Fraunces', weight: 400, file: 'fraunces-400-v1.woff2' },
  { family: 'Fraunces', weight: 500, file: 'fraunces-500-v1.woff2' },
  { family: 'Fraunces', weight: 600, file: 'fraunces-600-v1.woff2' },
  { family: 'Inter', weight: 400, file: 'inter-400-v1.woff2' },
  { family: 'Inter', weight: 500, file: 'inter-500-v1.woff2' },
  { family: 'Inter', weight: 600, file: 'inter-600-v1.woff2' },
  { family: 'Inter', weight: 700, file: 'inter-700-v1.woff2' },
];

const fontFaceCss = FONT_FACES.map(
  ({ family, weight, file }) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(/fonts/${file}) format("woff2")}`,
).join('');

// Web-only document shell. Fraunces/Inter are self-hosted here instead of loaded through
// expo-font or Google Fonts (a render-blocking third-party stylesheet).
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Only the two Fraunces weights the first screens use: 400 (brand, first-paint shell)
            and 500 (home hero heading; unpreloaded it swapped in late and shifted the hero).
            Inter isn't needed until later and extra preloads compete with the bundle. */}
        <link
          rel="preload"
          href="/fonts/fraunces-400-v1.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/fraunces-500-v1.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <style id="font-faces" dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
        <style id="critical-theme" dangerouslySetInnerHTML={{ __html: criticalCss }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
