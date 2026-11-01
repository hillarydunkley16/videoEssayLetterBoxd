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

  it('applies the shell overrides only inside the dark media query', () => {
    const css = markup.match(/<style id="critical-theme">([\s\S]*?)<\/style>/)?.[1] ?? '';
    const beforeDark = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));
    expect(css).toContain('[style*=');
    expect(beforeDark).not.toContain('[style*=');
  });
});

describe('web document fonts', () => {
  // Self-hosted subsets of the same weights the Google Fonts link used to request.
  const faces = [
    ['Fraunces', 400, 'fraunces-400-v1.woff2'],
    ['Fraunces', 500, 'fraunces-500-v1.woff2'],
    ['Fraunces', 600, 'fraunces-600-v1.woff2'],
    ['Inter', 400, 'inter-400-v1.woff2'],
    ['Inter', 500, 'inter-500-v1.woff2'],
    ['Inter', 600, 'inter-600-v1.woff2'],
    ['Inter', 700, 'inter-700-v1.woff2'],
  ] as const;

  it('does not depend on Google Fonts', () => {
    expect(markup).not.toContain('fonts.googleapis.com');
    expect(markup).not.toContain('fonts.gstatic.com');
  });

  it.each(faces)('declares %s %i from a self-hosted woff2 with font-display: swap', (family, weight, file) => {
    expect(markup).toContain(
      `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(/fonts/${file}) format("woff2")}`,
    );
  });

  it.each(faces)('ships the file for %s %i in public/fonts', (_family, _weight, file) => {
    const filePath = path.join(__dirname, '../../public/fonts', file);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(1000);
  });

  it('preloads only the font the first-paint shell uses (Fraunces 400, the brand)', () => {
    const preloads = markup.match(/<link rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
    expect(preloads).toHaveLength(1);
    expect(preloads[0]).toContain('href="/fonts/fraunces-400-v1.woff2"');
    expect(preloads[0]).toContain('type="font/woff2"');
    expect(preloads[0]).toContain('crossorigin=""');
  });
});
