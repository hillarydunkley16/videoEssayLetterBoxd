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
  hasSignedInHint: jest.fn(() => false),
  setSignedInHint: jest.fn(),
  clearSignedInHint: jest.fn(),
}));

import { HeroGate } from '../HeroGate';
import { clearSignedInHint, hasSignedInHint, setSignedInHint } from '@/src/lib/signedInHint';

const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  (hasSignedInHint as jest.Mock).mockReturnValue(false);
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
  const loading = () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
  };

  it('web, Clerk loading, was signed in last time: shows the feed skeleton, not the hero', () => {
    loading();
    (hasSignedInHint as jest.Mock).mockReturnValue(true);
    renderGate();
    expect(screen.getByTestId('web-shell-skeleton')).toBeTruthy();
    expect(screen.queryByText('HERO')).toBeNull();
  });

  it('web, Clerk loading, no hint: still shows the hero', () => {
    loading();
    renderGate();
    expect(screen.getByText('HERO')).toBeTruthy();
    expect(screen.queryByTestId('web-shell-skeleton')).toBeNull();
  });

  it('the server render and first client render still show the hero even with the hint, so hydration matches', () => {
    loading();
    (hasSignedInHint as jest.Mock).mockReturnValue(true);
    const html = renderToStaticMarkup(
      <HeroGate>
        <span>HERO</span>
      </HeroGate>,
    );
    expect(html).toContain('HERO');
  });

  it('web, loaded and signed in: remembers it for next time and shows no hero or skeleton', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = true;
    renderGate();
    expect(setSignedInHint).toHaveBeenCalled();
    expect(screen.queryByText('HERO')).toBeNull();
    expect(screen.queryByTestId('web-shell-skeleton')).toBeNull();
  });

  it('web, loaded and signed out: forgets the hint and shows the hero', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = false;
    renderGate();
    expect(clearSignedInHint).toHaveBeenCalled();
    expect(screen.getByText('HERO')).toBeTruthy();
  });

  it('native: never touches the hint', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = true;
    renderGate();
    expect(hasSignedInHint).not.toHaveBeenCalled();
    expect(setSignedInHint).not.toHaveBeenCalled();
    expect(clearSignedInHint).not.toHaveBeenCalled();
  });
});
