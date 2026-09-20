/**
 * Followers list screen.
 *
 * Rows come from the paginated followers endpoint, the next page is requested when the
 * list end is reached, the inline toggle updates only its own row from the server's
 * answer, and an empty list shows an empty state. Clerk, the network and navigation are stubbed.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

const mockFetchFollowers = jest.fn();
const mockFetchProfile = jest.fn();
const mockFollowUser = jest.fn();
jest.mock('@/src/api/users', () => ({
  fetchFollowers: (...args: unknown[]) => mockFetchFollowers(...args),
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
  followUser: (...args: unknown[]) => mockFollowUser(...args),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));

jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: (props: Record<string, unknown>) => <Text {...props} /> };
});

import FollowListScreen from '../FollowListScreen';

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

function row(id: number, username: string, is_following = false) {
  return { id, username, imageUrl: null, is_following };
}

function page(results: ReturnType<typeof row>[], next: string | null = null) {
  return { count: results.length, next, previous: null, results };
}

describe('FollowListScreen (followers)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProfile.mockResolvedValue({ user: { id: 1, username: 'me' } });
  });

  it('renders a row per follower', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann'), row(3, 'ben')]));
    render(<FollowListScreen userId={9} />);

    expect(await screen.findByText('ann')).toBeTruthy();
    expect(screen.getByText('ben')).toBeTruthy();
    expect(mockFetchFollowers).toHaveBeenCalledWith(9, 1, 'token');
  });

  it('requests the next page when the end of the list is reached', async () => {
    mockFetchFollowers
      .mockResolvedValueOnce(page([row(2, 'ann')], 'http://x/?page=2'))
      .mockResolvedValueOnce(page([row(3, 'ben')]));
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');

    fireEvent(screen.getByTestId('follow-list'), 'endReached');

    expect(await screen.findByText('ben')).toBeTruthy();
    expect(mockFetchFollowers).toHaveBeenLastCalledWith(9, 2, 'token');
    expect(screen.getByText('ann')).toBeTruthy();
  });

  it('does not request another page when there is no next page', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann')]));
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');

    fireEvent(screen.getByTestId('follow-list'), 'endReached');

    expect(mockFetchFollowers).toHaveBeenCalledTimes(1);
  });

  it('toggling a row updates only that row', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann'), row(3, 'ben')]));
    mockFollowUser.mockResolvedValue({ following: true, followers_count: 4 });
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');

    fireEvent.press(screen.getByTestId('follow-toggle-2'));

    await waitFor(() => expect(within(screen.getByTestId('follow-toggle-2')).getByText('Following')).toBeTruthy());
    expect(within(screen.getByTestId('follow-toggle-3')).getByText('Follow')).toBeTruthy();
    expect(mockFollowUser).toHaveBeenCalledWith(2, expect.anything());
  });

  it('leaves the row unchanged when the toggle fails', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann')]));
    mockFollowUser.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');

    fireEvent.press(screen.getByTestId('follow-toggle-2'));

    await waitFor(() => expect(mockFollowUser).toHaveBeenCalled());
    expect(within(screen.getByTestId('follow-toggle-2')).getByText('Follow')).toBeTruthy();
  });

  it('shows no toggle on the viewer\'s own row', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(1, 'me'), row(2, 'ann')]));
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');

    expect(screen.queryByTestId('follow-toggle-1')).toBeNull();
    expect(screen.getByTestId('follow-toggle-2')).toBeTruthy();
  });

  it('pressing a row opens that profile, and the own row opens the own profile', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(1, 'me'), row(2, 'ann')]));
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');

    fireEvent.press(screen.getByText('ann'));
    expect(mockPush).toHaveBeenLastCalledWith('/otherProfile/2');

    fireEvent.press(screen.getByText('me'));
    expect(mockPush).toHaveBeenLastCalledWith('/profile');
  });

  it('shows an empty state when there are no followers', async () => {
    mockFetchFollowers.mockResolvedValue(page([]));
    render(<FollowListScreen userId={9} />);

    expect(await screen.findByText('No followers yet.')).toBeTruthy();
  });
});
