/**
 * Web document shell: critical CSS.
 *
 * The first paint must already be themed, and in dark mode the statically exported shell
 * (which carries light colors inline, because the web useColorScheme is `light` until
 * hydration) must be recolored by CSS so it doesn't flash light.
 */
import React from 'react';
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
