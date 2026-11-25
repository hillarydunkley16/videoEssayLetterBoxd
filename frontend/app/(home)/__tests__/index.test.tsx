/**
 * Home feed switch.
 *
 * Home keeps the existing "everyone" feed as the default and adds a "Following" feed the
 * viewer can switch to (and back). The two feed screens are stubbed so only the switch runs.
 */
import React from 'react';
import { Platform } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockAuth: { isLoaded: boolean; isSignedIn?: boolean } = { isLoaded: true, isSignedIn: true };

jest.mock('@clerk/clerk-expo', () => ({
  useUser: () => ({ user: { id: 'u' } }),
  useSession: () => ({ session: null }),
  useAuth: () => mockAuth,
  SignedIn: ({ children }: { children: React.ReactNode }) =>
    mockAuth.isLoaded && mockAuth.isSignedIn ? <>{children}</> : null,
}));
jest.mock('expo-router', () => ({ Link: 'Link' }));
jest.mock('../../../global.css', () => ({}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: (props: Record<string, unknown>) => <View {...props} />,
    SafeAreaView: (props: Record<string, unknown>) => <View {...props} />,
  };
});
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: (props: Record<string, unknown>) => <Text {...props} /> };
});
jest.mock('../../components/sign-out-button', () => ({ SignOutButton: () => null }));
jest.mock('@/src/screens/SearchScreen', () => () => null);
jest.mock('@/src/screens/SignedOutHomeScreen', () => {
  const { Text } = require('react-native');
  const Hero = () => <Text>HERO</Text>;
  return Hero;
});
jest.mock('@/src/screens/RecentLogsScreen', () => {
  const { Text } = require('react-native');
  const EveryoneFeed = () => <Text>EVERYONE FEED</Text>;
  return EveryoneFeed;
});
jest.mock('@/src/screens/FollowingFeedScreen', () => {
  const { Text } = require('react-native');
  const FollowingFeed = () => <Text>FOLLOWING FEED</Text>;
  return FollowingFeed;
});
jest.mock('@/src/components/UsernameGateBanner', () => {
  const { Text } = require('react-native');
  const UsernameGateBanner = () => <Text>USERNAME BANNER</Text>;
  return UsernameGateBanner;
});

import Page from '../index';

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

afterEach(() => {
  mockAuth.isLoaded = true;
  mockAuth.isSignedIn = true;
  jest.restoreAllMocks();
});

describe('home signed-out hero', () => {
  it('web, Clerk loading: shows the hero and not the feed', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    render(<Page />);
    expect(screen.getByText('HERO')).toBeTruthy();
    expect(screen.queryByText('EVERYONE FEED')).toBeNull();
  });

  it('loaded and signed out: shows the hero and not the feed', () => {
    mockAuth.isSignedIn = false;
    render(<Page />);
    expect(screen.getByText('HERO')).toBeTruthy();
    expect(screen.queryByText('EVERYONE FEED')).toBeNull();
  });

  it('loaded and signed in: shows the feed and not the hero', () => {
    render(<Page />);
    expect(screen.getByText('EVERYONE FEED')).toBeTruthy();
    expect(screen.queryByText('HERO')).toBeNull();
  });
});

describe('home auth transitions', () => {
  it('web, Clerk loading: mounts no signed-in content (no feed or banner, so no authenticated fetches)', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    render(<Page />);
    expect(screen.queryByText('EVERYONE FEED')).toBeNull();
    expect(screen.queryByText('FOLLOWING FEED')).toBeNull();
    expect(screen.queryByText('USERNAME BANNER')).toBeNull();
    expect(screen.queryByTestId('home-tab-everyone')).toBeNull();
  });

  it('web: a signed-in user sees the hero while Clerk loads, then the feed replaces it', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockAuth.isSignedIn = undefined;
    const { rerender } = render(<Page />);
    expect(screen.getByText('HERO')).toBeTruthy();

    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = true;
    rerender(<Page />);
    expect(screen.getByText('EVERYONE FEED')).toBeTruthy();
    expect(screen.getByText('USERNAME BANNER')).toBeTruthy();
    expect(screen.queryByText('HERO')).toBeNull();
  });

  it('signing out returns to the hero and removes the feed', () => {
    const { rerender } = render(<Page />);
    expect(screen.getByText('EVERYONE FEED')).toBeTruthy();

    mockAuth.isSignedIn = false;
    rerender(<Page />);
    expect(screen.getByText('HERO')).toBeTruthy();
    expect(screen.queryByText('EVERYONE FEED')).toBeNull();
    expect(screen.queryByText('USERNAME BANNER')).toBeNull();
  });
});

describe('home feed switch', () => {
  it('mounts the username gate banner inside the signed-in feed', () => {
    render(<Page />);
    expect(screen.getByText('USERNAME BANNER')).toBeTruthy();
  });

  it('shows the everyone feed by default', () => {
    render(<Page />);

    expect(screen.getByText('EVERYONE FEED')).toBeTruthy();
    expect(screen.queryByText('FOLLOWING FEED')).toBeNull();
  });

  it('switches to the following feed and back', () => {
    render(<Page />);

    fireEvent.press(screen.getByTestId('home-tab-following'));
    expect(screen.getByText('FOLLOWING FEED')).toBeTruthy();
    expect(screen.queryByText('EVERYONE FEED')).toBeNull();

    fireEvent.press(screen.getByTestId('home-tab-everyone'));
    expect(screen.getByText('EVERYONE FEED')).toBeTruthy();
  });
});
