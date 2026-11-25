/**
 * Follow button on another user's profile.
 *
 * Initial state must come from the backend's `is_following` / `followers_count`
 * (not from matching the Clerk id against a followers list), toggling must reflect
 * the server's answer, a double-tap must post once, and a failed toggle must leave
 * the button and count untouched.
 *
 * Clerk, the network and nested screens are stubbed so only this screen's logic runs.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
  useUser: () => ({ user: { id: 'user_clerk_me' } }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
}));

const mockFetchProfile = jest.fn();
const mockFollowUser = jest.fn();
jest.mock('@/src/api/users', () => ({
  fetchAProfileById: (...args: unknown[]) => mockFetchProfile(...args),
  followUser: (...args: unknown[]) => mockFollowUser(...args),
}));
jest.mock('@/src/api/authUpdate', () => ({ useAuthUpdate: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));

jest.mock('expo-image-picker', () => ({}));
jest.mock('@/app/components/sign-out-button', () => () => null);
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: (props: Record<string, unknown>) => <Text {...props} /> };
});

import OtherProfile from '../[id]';

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

const followButton = () => within(screen.getByTestId('follow-button'));
const count = (testID: 'followers-count' | 'following-count') => within(screen.getByTestId(testID));

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user: { id: 7, username: 'bob', logs: null, imageUrl: '' },
    imageUrl: null,
    user_logs: [],
    followers_count: 3,
    following_count: 1,
    is_following: false,
    watchList: { id: 1, public_id: 'wl', name: "bob's Watchlist", owner: 'bob', essays: [] },
    ...overrides,
  };
}

describe('other profile follow button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows Follow and the follower count when the viewer is not following', async () => {
    mockFetchProfile.mockResolvedValue(profile({ is_following: false, followers_count: 3 }));

    render(<OtherProfile />);

    await screen.findByTestId('follow-button');
    expect(followButton().getByText('Follow')).toBeTruthy();
    expect(count('followers-count').getByText('3')).toBeTruthy();
  });

  it('shows Following when the backend says the viewer follows them', async () => {
    mockFetchProfile.mockResolvedValue(profile({ is_following: true, followers_count: 4 }));

    render(<OtherProfile />);

    await screen.findByTestId('follow-button');
    expect(followButton().getByText('Following')).toBeTruthy();
    expect(count('followers-count').getByText('4')).toBeTruthy();
  });

  it('does not decide follow state from a followers list', async () => {
    // Old payload shape: the viewer's Clerk id appears in an embedded followers list.
    mockFetchProfile.mockResolvedValue(
      profile({ is_following: false, followers: [{ id: 1, username: 'user_clerk_me' }] }),
    );

    render(<OtherProfile />);

    await screen.findByTestId('follow-button');
    expect(followButton().getByText('Follow')).toBeTruthy();
  });

  it('updates the button and count from the server response on toggle', async () => {
    mockFetchProfile.mockResolvedValue(profile({ is_following: false, followers_count: 3 }));
    mockFollowUser.mockResolvedValue({ following: true, followers_count: 4 });

    render(<OtherProfile />);
    fireEvent.press(await screen.findByTestId('follow-button'));

    await waitFor(() => expect(followButton().getByText('Following')).toBeTruthy());
    expect(count('followers-count').getByText('4')).toBeTruthy();
    expect(mockFollowUser).toHaveBeenCalledWith(7, expect.any(Function));
  });

  it('posts the follow only once when double-tapped', async () => {
    mockFetchProfile.mockResolvedValue(profile());
    let resolveFollow: (value: unknown) => void = () => {};
    mockFollowUser.mockImplementation(() => new Promise((resolve) => { resolveFollow = resolve; }));

    render(<OtherProfile />);
    const button = await screen.findByTestId('follow-button');
    fireEvent.press(button);
    fireEvent.press(button);
    resolveFollow({ following: true, followers_count: 4 });

    await waitFor(() => expect(followButton().getByText('Following')).toBeTruthy());
    expect(mockFollowUser).toHaveBeenCalledTimes(1);
  });

  it('leaves the button and count unchanged when the toggle fails', async () => {
    mockFetchProfile.mockResolvedValue(profile({ is_following: false, followers_count: 3 }));
    mockFollowUser.mockRejectedValue(new Error('network'));

    render(<OtherProfile />);
    fireEvent.press(await screen.findByTestId('follow-button'));

    await waitFor(() => expect(mockFollowUser).toHaveBeenCalled());
    expect(followButton().getByText('Follow')).toBeTruthy();
    expect(count('followers-count').getByText('3')).toBeTruthy();
  });

  it('opens the followers list from the follower count and the following list from the following count', async () => {
    mockFetchProfile.mockResolvedValue(profile({ followers_count: 3, following_count: 5 }));

    render(<OtherProfile />);
    fireEvent.press(await screen.findByTestId('followers-count'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/followList', params: { userId: '7', tab: 'followers' } });

    expect(count('following-count').getByText('5')).toBeTruthy();
    fireEvent.press(screen.getByTestId('following-count'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/followList', params: { userId: '7', tab: 'following' } });
  });

  it('shows an error message instead of a spinner when the profile fails to load', async () => {
    mockFetchProfile.mockRejectedValue(new Error('network'));

    render(<OtherProfile />);

    expect(await screen.findByText('Unable to load profile')).toBeTruthy();
    expect(screen.queryByTestId('follow-button')).toBeNull();
  });
});
