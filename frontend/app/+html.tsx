import { ScrollViewStyleReset } from 'expo-router/html';
import { Colors } from '@/constants/theme';
import { FRAUNCES_500_ASCII_BASE64 } from '@/constants/fraunces500Ascii';

const { light, dark } = Colors;

// react-native-web serializes the hex theme colors inline as rgba(r,g,b,1.00).
const rnwRgba = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},1.00)`;
};

const textColorOverride = (lightHex: string, darkColor: string) =>
  `[style^="color:${rnwRgba(lightHex)}"],[style*=";color:${rnwRgba(lightHex)}"]{color:${darkColor}!important}`;

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
  // The home hero is also in the static HTML: its muted/teal/cobalt text. Anchored so
  // background-color and border-color values aren't matched.
  textColorOverride(light.muted, dark.muted) +
  textColorOverride(light.accent2, dark.accent2) +
  textColorOverride(light.accent, dark.accent) +
  '}';

// Self-hosted Latin/Latin-Extended woff2 subsets of the weights the app uses (served from
// frontend/public/fonts). The -vN suffix is part of the name because /fonts/* is cached
// immutably: bump it when a file changes.
// Fraunces swaps in: its first-paint weights are preloaded (400) or inlined (500). Inter is
// `optional`: its files arrive after first paint on Slow 4G, and swapping the body text from
// the system font to the wider Inter re-wrapped the cards and shifted the page (CLS ~0.22).
// With optional, a view that doesn't have Inter in time keeps the system font; repeat visits
// get Inter from the cache.
const FONT_FACES = [
  { family: 'Fraunces', weight: 400, file: 'fraunces-400-v1.woff2', display: 'swap' },
  { family: 'Fraunces', weight: 500, file: 'fraunces-500-v1.woff2', display: 'swap' },
  { family: 'Fraunces', weight: 600, file: 'fraunces-600-v1.woff2', display: 'swap' },
  { family: 'Inter', weight: 400, file: 'inter-400-v1.woff2', display: 'optional' },
  { family: 'Inter', weight: 500, file: 'inter-500-v1.woff2', display: 'optional' },
  { family: 'Inter', weight: 600, file: 'inter-600-v1.woff2', display: 'optional' },
  { family: 'Inter', weight: 700, file: 'inter-700-v1.woff2', display: 'optional' },
];

// Fraunces 500 is the home hero's headline weight and the LCP element. The hero paints ~40 ms
// before even a preloaded font arrives on Slow 4G, so the swap re-wrapped the headline and
// shifted the page (CLS 0.24). The ASCII subset is therefore inlined (~15 kB base64): it is
// declared after the file face so it wins for those characters, and the file is only fetched
// for anything outside it.
const fraunces500InlineCss =
  `@font-face{font-family:'Fraunces';font-style:normal;font-weight:500;font-display:swap;src:url(data:font/woff2;base64,${FRAUNCES_500_ASCII_BASE64}) format("woff2");` +
  'unicode-range:U+0020-007E,U+00A0,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026}';

const fontFaceCss = FONT_FACES.map(
  ({ family, weight, file, display }) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:${display};src:url(/fonts/${file}) format("woff2")}`,
).join('') + fraunces500InlineCss;

// Web-only document shell. Fraunces/Inter are self-hosted here instead of loaded through
// expo-font or Google Fonts (a render-blocking third-party stylesheet).
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Only the brand font, used by the first-paint shell. Fraunces 500 is inlined below;
            Inter isn't needed until later and extra preloads compete with the bundle. */}
        <link
          rel="preload"
          href="/fonts/fraunces-400-v1.woff2"
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
