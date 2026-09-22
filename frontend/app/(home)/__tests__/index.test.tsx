/**
 * Home feed switch.
 *
 * Home keeps the existing "everyone" feed as the default and adds a "Following" feed the
 * viewer can switch to (and back). The two feed screens are stubbed so only the switch runs.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('@clerk/clerk-expo', () => ({
  useUser: () => ({ user: { id: 'u' } }),
  useSession: () => ({ session: null }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
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
jest.mock('@/src/screens/SignedOutHomeScreen', () => () => null);
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
