/**
 * HeroGate: the signed-out branch of the home screen.
 *
 * On web it also shows while Clerk is still loading, so the hero is in the static HTML and
 * on screen before Clerk's scripts arrive. Native keeps Clerk's SignedOut semantics.
 */
import React from 'react';
import { Platform, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockAuth: { isLoaded: boolean; isSignedIn?: boolean } = { isLoaded: false };

jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => mockAuth }));
jest.mock('@/src/lib/signedInHint', () => ({
  setSignedInHint: jest.fn(),
  clearSignedInHint: jest.fn(),
}));

import { HeroGate } from '../HeroGate';
import { clearSignedInHint, setSignedInHint } from '@/src/lib/signedInHint';

const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const renderGate = () =>
  render(
    <HeroGate>
      <Text>HERO</Text>
    </HeroGate>,
  );

describe('HeroGate', () => {
  it('web, Clerk loading: shows the hero', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    renderGate();
    expect(screen.getByText('HERO')).toBeTruthy();
  });

  it('web, loaded and signed out: keeps the hero', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = false;
    renderGate();
    expect(screen.getByText('HERO')).toBeTruthy();
  });

  it('web, loaded and signed in: hides the hero', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = true;
    renderGate();
    expect(screen.queryByText('HERO')).toBeNull();
  });

  it('native, Clerk loading: shows nothing', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    renderGate();
    expect(screen.queryByText('HERO')).toBeNull();
  });

  it('native, loaded and signed out: shows the hero', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = false;
    renderGate();
    expect(screen.getByText('HERO')).toBeTruthy();
  });
});

describe('HeroGate returning-visitor skeleton', () => {
  // The inline script in +html sets data-returning on <html> before first paint; CSS then hides
  // [data-testid="home-hero"] and shows [data-testid="home-returning-skeleton"]. So both are in the
  // DOM (static HTML included) and only CSS decides which one is visible: nothing to hydrate-mismatch.
  const removeAttribute = jest.fn();

  beforeEach(() => {
    removeAttribute.mockClear();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { documentElement: { removeAttribute } },
    });
  });

  afterEach(() => {
    // @ts-expect-error restore "no document"
    delete globalThis.document;
  });

  it('web: wraps the hero and renders a skeleton beside it (hidden by CSS unless the visitor is returning)', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    renderGate();
    expect(screen.getByTestId('home-hero')).toBeTruthy();
    expect(screen.getByText('HERO')).toBeTruthy();
    expect(screen.getByTestId('home-returning-skeleton')).toBeTruthy();
    expect(screen.getByTestId('web-shell-skeleton')).toBeTruthy();
  });

  it('server render has both, so the static HTML can show either before JS runs', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    const html = renderToStaticMarkup(
      <HeroGate>
        <span>HERO</span>
      </HeroGate>,
    );
    expect(html).toContain('HERO');
    expect(html).toContain('home-returning-skeleton');
  });

  it('web, loaded and signed in: remembers it for next time and renders neither hero nor skeleton', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = true;
    renderGate();
    expect(setSignedInHint).toHaveBeenCalled();
    expect(screen.queryByText('HERO')).toBeNull();
    expect(screen.queryByTestId('home-returning-skeleton')).toBeNull();
  });

  it('web, loaded and signed out: forgets the hint, drops data-returning so the hero shows again', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = false;
    renderGate();
    expect(clearSignedInHint).toHaveBeenCalled();
    expect(removeAttribute).toHaveBeenCalledWith('data-returning');
    expect(screen.getByText('HERO')).toBeTruthy();
  });

  it('web, Clerk still loading: leaves data-returning alone', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    renderGate();
    expect(removeAttribute).not.toHaveBeenCalled();
    expect(clearSignedInHint).not.toHaveBeenCalled();
  });

  it('native: no wrappers, never touches the hint', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = false;
    renderGate();
    expect(screen.getByText('HERO')).toBeTruthy();
    expect(screen.queryByTestId('home-hero')).toBeNull();
    expect(setSignedInHint).not.toHaveBeenCalled();
    expect(clearSignedInHint).not.toHaveBeenCalled();
  });
});
