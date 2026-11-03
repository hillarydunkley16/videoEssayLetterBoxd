import { ScrollViewStyleReset } from 'expo-router/html';
import { Colors } from '@/constants/theme';
import { FRAUNCES_500_ASCII_BASE64 } from '@/constants/fraunces500Ascii';
import { SIGNED_IN_HINT_KEY } from '@/src/lib/signedInHint';
import { clerkFrontendHost, clerkScriptUrl } from '@/src/lib/clerkHost';

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
  // Returning signed-in visitors (see returningHintScript): skeleton instead of the hero.
  // !important: react-native-web's atomic `display:flex` class has the same specificity and loads later.
  '[data-testid="home-returning-skeleton"]{display:none!important}' +
  'html[data-returning] [data-testid="home-returning-skeleton"]{display:flex!important}' +
  'html[data-returning] [data-testid="home-hero"]{display:none!important}' +
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
// for anything outside it. `block`, not `swap`: even a data-URI font decodes a few ms after the
// first frame, and swap painted that frame in the fallback (headline one line shorter, so
// everything below moved 34px: CLS 0.23). Block holds the text for those ms instead.
const fraunces500InlineCss =
  `@font-face{font-family:'Fraunces';font-style:normal;font-weight:500;font-display:block;src:url(data:font/woff2;base64,${FRAUNCES_500_ASCII_BASE64}) format("woff2");` +
  'unicode-range:U+0020-007E,U+00A0,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026}';

const fontFaceCss = FONT_FACES.map(
  ({ family, weight, file, display }) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:${display};src:url(/fonts/${file}) format("woff2")}`,
).join('') + fraunces500InlineCss;

// Clerk's script is only requested after the 1 MB app bundle has run, so a signed-in user waited
// for the bundle and then for Clerk's redirect, connection and download in series. Hinting it
// here starts those in parallel. Host derived from the publishable key (never hardcoded).
const clerkHost = clerkFrontendHost(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Runs before first paint: a visitor who was signed in last time gets data-returning on <html>,
// so CSS can swap the marketing hero for the feed skeleton (see HeroGate). A hint only; Clerk
// still decides. Same key as src/lib/signedInHint.ts.
const returningHintScript = `try{if(localStorage.getItem(${JSON.stringify(SIGNED_IN_HINT_KEY)})==='1')document.documentElement.setAttribute('data-returning','')}catch(e){}`;

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
        {clerkHost ? (
          <>
            <link rel="preconnect" href={`https://${clerkHost}`} crossOrigin="" />
            <link rel="preload" href={clerkScriptUrl(clerkHost)} as="script" crossOrigin="anonymous" />
          </>
        ) : null}
        <script id="returning-hint" dangerouslySetInnerHTML={{ __html: returningHintScript }} />
        <style id="font-faces" dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
        <style id="critical-theme" dangerouslySetInnerHTML={{ __html: criticalCss }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
