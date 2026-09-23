/**
 * Visual Arguments design tokens.
 *
 * Palette: cool graphite/stone neutrals with a single cobalt-blue pop for
 * ratings and primary actions, and a muted teal accent for secondary
 * toggles (rewatch, watchlist) that stays quiet so the cobalt reads as the
 * one accent color. Mirrors the published design-system mockup's :root
 * custom properties 1:1 so screens can be ported by eye.
 */

import { Platform } from 'react-native';

const ink = '#1B1D21';
const paper = '#F1F1EE';
const paperDim = '#E2E2DD';
const cobalt = '#2F5DFF';
const teal = '#1E7A6C';
const slate = '#63666C';

export const Palette = {
  ink,
  paper,
  paperDim,
  cobalt,
  teal,
  slate,
};

export const Colors = {
  light: {
    text: ink,
    background: paper,
    surface: paperDim,
    muted: slate,
    border: 'rgba(27,29,33,0.14)',
    tint: cobalt,
    accent: cobalt,
    accent2: teal,
    error: '#D93025',
    icon: slate,
    tabIconDefault: slate,
    tabIconSelected: cobalt,
  },
  dark: {
    text: paper,
    background: ink,
    surface: '#24262B',
    muted: '#93969E',
    border: 'rgba(241,241,238,0.14)',
    tint: '#5B7CFF',
    accent: '#5B7CFF',
    accent2: '#2FA593',
    error: '#FF6B6B',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#5B7CFF',
  },
};

// Display type (titles/headings) is Fraunces; body/UI type is Inter.
// Native font family names must match the @expo-google-fonts asset names
// loaded via useFonts (see app/hooks/use-app-fonts.ts); web falls back to
// the Google Fonts stylesheet linked in app/+html.tsx.
export const Fonts = Platform.select({
  web: {
    display: "'Fraunces', Georgia, 'Times New Roman', serif",
    displayMedium: "'Fraunces', Georgia, 'Times New Roman', serif",
    sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    sansMedium: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    sansSemiBold: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  default: {
    display: 'Fraunces_400Regular',
    displayMedium: 'Fraunces_500Medium',
    sans: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemiBold: 'Inter_600SemiBold',
  },
});

export default Colors;
