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

import { HeroGate } from '../HeroGate';

afterEach(() => {
  jest.restoreAllMocks();
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
