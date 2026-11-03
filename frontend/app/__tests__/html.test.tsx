/**
 * Web document shell: critical CSS.
 *
 * The first paint must already be themed, and in dark mode the statically exported shell
 * (which carries light colors inline, because the web useColorScheme is `light` until
 * hydration) must be recolored by CSS so it doesn't flash light.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Colors } from '@/constants/theme';
import { FRAUNCES_500_ASCII_BASE64 } from '@/constants/fraunces500Ascii';
import { SIGNED_IN_HINT_KEY } from '@/src/lib/signedInHint';
import vm from 'vm';

import Root from '../+html';

// react-dom has no bundled types here and @types/react-dom isn't a dependency.
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};

const markup = renderToStaticMarkup(<Root>{null}</Root>);

describe('web document critical CSS', () => {
  it('paints the light theme background and text before any JS runs', () => {
    expect(markup).toContain(
      `body{background-color:${Colors.light.background};color:${Colors.light.text}}`,
    );
  });

  it('switches the body to the dark theme under prefers-color-scheme: dark', () => {
    expect(markup).toContain(
      `@media (prefers-color-scheme: dark){body{background-color:${Colors.dark.background};color:${Colors.dark.text}}`,
    );
  });

  it('recolors the pre-rendered light shell in dark mode (inline styles need !important)', () => {
    // Light inline values as react-native-web serializes them: paper = #F1F1EE, surface = #E2E2DD.
    expect(markup).toContain(
      `[style*="background-color:rgba(241,241,238,1.00)"]{background-color:${Colors.dark.background}!important}`,
    );
    expect(markup).toContain(
      `[style*="background-color:rgba(226,226,221,1.00)"]{background-color:${Colors.dark.surface}!important}`,
    );
    expect(markup).toContain(
      `[style*="color:rgba(27,29,33,1.00)"]{color:${Colors.dark.text}!important}`,
    );
    expect(markup).toContain(
      `[style*="border-top-color:rgba(27,29,33,0.14)"]{border-color:${Colors.dark.border}!important}`,
    );
  });

  it('recolors the pre-rendered hero text (muted, teal, cobalt) in dark mode', () => {
    // The home hero is in the static HTML, so its text carries light-theme colors until hydration.
    const cases: [string, string][] = [
      ['rgba(99,102,108,1.00)', Colors.dark.muted], // slate -> muted
      ['rgba(30,122,108,1.00)', Colors.dark.accent2], // teal -> accent2
      ['rgba(47,93,255,1.00)', Colors.dark.accent], // cobalt -> accent
    ];
    for (const [light, dark] of cases) {
      // Anchored to the start of the style or after ';' so background-color/border-color don't match.
      expect(markup).toContain(
        `[style^="color:${light}"],[style*=";color:${light}"]{color:${dark}!important}`,
      );
    }
  });

  it('applies the shell overrides only inside the dark media query', () => {
    const css = markup.match(/<style id="critical-theme">([\s\S]*?)<\/style>/)?.[1] ?? '';
    const beforeDark = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));
    expect(css).toContain('[style*=');
    expect(beforeDark).not.toContain('[style*=');
  });
});

describe('web document fonts', () => {
  // Self-hosted subsets of the same weights the Google Fonts link used to request.
  // Fraunces swaps in (its first-paint weights are preloaded or inlined). Inter is `optional`:
  // its files arrive after first paint on Slow 4G, and swapping the body text from the system
  // font to the wider Inter re-wrapped the cards and shifted the page (CLS ~0.22).
  const faces = [
    ['Fraunces', 400, 'fraunces-400-v1.woff2', 'swap'],
    ['Fraunces', 500, 'fraunces-500-v1.woff2', 'swap'],
    ['Fraunces', 600, 'fraunces-600-v1.woff2', 'swap'],
    ['Inter', 400, 'inter-400-v1.woff2', 'optional'],
    ['Inter', 500, 'inter-500-v1.woff2', 'optional'],
    ['Inter', 600, 'inter-600-v1.woff2', 'optional'],
    ['Inter', 700, 'inter-700-v1.woff2', 'optional'],
  ] as const;

  it('does not depend on Google Fonts', () => {
    expect(markup).not.toContain('fonts.googleapis.com');
    expect(markup).not.toContain('fonts.gstatic.com');
  });

  it.each(faces)('declares %s %i from %s with font-display: %s', (family, weight, file, display) => {
    expect(markup).toContain(
      `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:${display};src:url(/fonts/${file}) format("woff2")}`,
    );
  });

  it.each(faces)('ships the file for %s %i in public/fonts', (_family, _weight, file) => {
    const filePath = path.join(__dirname, '../../public/fonts', file);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(1000);
  });

  // The hero paints ~40 ms before even a preloaded Fraunces arrives on Slow 4G. With swap the
  // headline re-wrapped from 2 to 3 lines and shifted the page (CLS 0.24; a metric-matched
  // Georgia fallback did not help), so the headline weight's ASCII subset is inlined.
  it('inlines the ASCII subset of Fraunces 500 as a data URI with font-display: block (no fallback frame), declared after the file so it wins for those characters', () => {
    const inline = `@font-face{font-family:'Fraunces';font-style:normal;font-weight:500;font-display:block;src:url(data:font/woff2;base64,${FRAUNCES_500_ASCII_BASE64}) format("woff2");unicode-range:U+0020-007E,U+00A0,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026}`;
    expect(markup).toContain(inline);
    expect(markup.indexOf(inline)).toBeGreaterThan(markup.indexOf('/fonts/fraunces-500-v1.woff2'));
  });

  it('the inlined font is a real woff2 and small enough not to slow first paint', () => {
    const bytes = Buffer.from(FRAUNCES_500_ASCII_BASE64, 'base64');
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(bytes.length).toBeLessThan(14000);
  });

  // Fraunces 400 is the brand in the first-paint shell. 500 (the hero heading weight) needs no
  // preload for ASCII text because that subset is inlined above.
  it('preloads only the brand font (Fraunces 400)', () => {
    const preloads = markup.match(/<link rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
    expect(preloads).toHaveLength(1);
    expect(preloads[0]).toContain('href="/fonts/fraunces-400-v1.woff2"');
    expect(preloads[0]).toContain('type="font/woff2"');
    expect(preloads[0]).toContain('crossorigin=""');
  });
});

describe('web document returning-visitor hint', () => {
  // A visitor who was signed in last time shouldn't see the marketing hero flash before the feed.
  // This script runs before first paint and marks <html>; the CSS below swaps hero for skeleton.
  const script = markup.match(/<script id="returning-hint">([\s\S]*?)<\/script>/)?.[1] ?? '';

  const run = (localStorage: unknown) => {
    const attrs: Record<string, string> = {};
    const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    vm.runInNewContext(script, { document, localStorage });
    return attrs;
  };

  it('is an inline script in the head, before the styles', () => {
    expect(script).not.toBe('');
    expect(markup.indexOf('id="returning-hint"')).toBeLessThan(markup.indexOf('id="critical-theme"'));
  });

  it('marks <html data-returning> when the signed-in hint is set', () => {
    const store = { getItem: (k: string) => (k === SIGNED_IN_HINT_KEY ? '1' : null) };
    expect(run(store)).toEqual({ 'data-returning': '' });
  });

  it('does nothing without the hint', () => {
    expect(run({ getItem: () => null })).toEqual({});
  });

  it('does not throw when storage is unavailable or throws', () => {
    expect(() => run(undefined)).not.toThrow();
    expect(() =>
      run({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).not.toThrow();
  });

  it('CSS: skeleton hidden by default, and for a returning visitor the hero hides and the skeleton shows', () => {
    const css = markup.match(/<style id="critical-theme">([\s\S]*?)<\/style>/)?.[1] ?? '';
    expect(css).toContain('[data-testid="home-returning-skeleton"]{display:none}');
    expect(css).toContain('html[data-returning] [data-testid="home-returning-skeleton"]{display:flex}');
    expect(css).toContain('html[data-returning] [data-testid="home-hero"]{display:none}');
  });
});
