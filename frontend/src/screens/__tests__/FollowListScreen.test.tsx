/**
 * Followers list screen.
 *
 * Rows come from the paginated followers endpoint, the next page is requested when the
 * list end is reached, the inline toggle updates only its own row from the server's
 * answer, and an empty list shows an empty state. Clerk, the network and navigation are stubbed.
 */
import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

const mockFetchFollowers = jest.fn();
const mockFetchFollowing = jest.fn();
const mockFetchProfile = jest.fn();
const mockFollowUser = jest.fn();
const mockRemoveFollower = jest.fn();
jest.mock('@/src/api/users', () => ({
  fetchFollowers: (...args: unknown[]) => mockFetchFollowers(...args),
  fetchFollowing: (...args: unknown[]) => mockFetchFollowing(...args),
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
  followUser: (...args: unknown[]) => mockFollowUser(...args),
  removeFollower: (...args: unknown[]) => mockRemoveFollower(...args),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));

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

describe('FollowListScreen (following tab)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProfile.mockResolvedValue({ user: { id: 1, username: 'me' } });
  });

  it('opens on the requested tab and lists who the user follows', async () => {
    mockFetchFollowing.mockResolvedValue(page([row(4, 'cat', true)]));
    render(<FollowListScreen userId={9} tab="following" />);

    expect(await screen.findByText('cat')).toBeTruthy();
    expect(mockFetchFollowing).toHaveBeenCalledWith(9, 1, 'token');
    expect(mockFetchFollowers).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('follow-toggle-4')).getByText('Following')).toBeTruthy();
  });

  it('switching tabs replaces the rows with the other list', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann')]));
    mockFetchFollowing.mockResolvedValue(page([row(4, 'cat')]));
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');

    fireEvent.press(screen.getByTestId('tab-following'));

    expect(await screen.findByText('cat')).toBeTruthy();
    expect(screen.queryByText('ann')).toBeNull();
    expect(mockFetchFollowing).toHaveBeenCalledWith(9, 1, 'token');
  });

  it('shows an empty state when the user follows nobody', async () => {
    mockFetchFollowing.mockResolvedValue(page([]));
    render(<FollowListScreen userId={9} tab="following" />);

    expect(await screen.findByText('Not following anyone yet.')).toBeTruthy();
  });

  it('paginates the following list', async () => {
    mockFetchFollowing
      .mockResolvedValueOnce(page([row(4, 'cat')], 'http://x/?page=2'))
      .mockResolvedValueOnce(page([row(5, 'dan')]));
    render(<FollowListScreen userId={9} tab="following" />);
    await screen.findByText('cat');

    fireEvent(screen.getByTestId('follow-list'), 'endReached');

    expect(await screen.findByText('dan')).toBeTruthy();
    expect(mockFetchFollowing).toHaveBeenLastCalledWith(9, 2, 'token');
  });
});

describe('FollowListScreen remove follower', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProfile.mockResolvedValue({ user: { id: 1, username: 'me' } });
  });

  it('shows Remove on each row of the viewer\'s own followers list', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann'), row(3, 'ben')]));
    render(<FollowListScreen userId={1} />);
    await screen.findByText('ann');

    expect(screen.getByTestId('remove-follower-2')).toBeTruthy();
    expect(screen.getByTestId('remove-follower-3')).toBeTruthy();
  });

  it('does not show Remove on someone else\'s followers list', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann')]));
    render(<FollowListScreen userId={9} />);
    await screen.findByText('ann');
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

    expect(screen.queryByTestId('remove-follower-2')).toBeNull();
  });

  it('does not show Remove on the viewer\'s own following tab', async () => {
    mockFetchFollowing.mockResolvedValue(page([row(4, 'cat')]));
    render(<FollowListScreen userId={1} tab="following" />);
    await screen.findByText('cat');
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

    expect(screen.queryByTestId('remove-follower-4')).toBeNull();
  });

  it('removes only that follower from the list', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann'), row(3, 'ben')]));
    mockRemoveFollower.mockResolvedValue(undefined);
    render(<FollowListScreen userId={1} />);
    await screen.findByText('ann');

    fireEvent.press(screen.getByTestId('remove-follower-2'));

    await waitFor(() => expect(mockRemoveFollower).toHaveBeenCalledWith(1, 2, expect.anything()));
    await waitFor(() => expect(screen.queryByText('ann')).toBeNull());
    expect(screen.getByText('ben')).toBeTruthy();
    expect(mockRemoveFollower).toHaveBeenCalledWith(1, 2, expect.anything());
  });

  it('keeps the row when removal fails', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann')]));
    mockRemoveFollower.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<FollowListScreen userId={1} />);
    await screen.findByText('ann');

    fireEvent.press(screen.getByTestId('remove-follower-2'));

    await waitFor(() => expect(mockRemoveFollower).toHaveBeenCalled());
    expect(screen.getByText('ann')).toBeTruthy();
  });

  it('removes only once when Remove is double-tapped', async () => {
    mockFetchFollowers.mockResolvedValue(page([row(2, 'ann')]));
    let resolve: () => void = () => {};
    mockRemoveFollower.mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    render(<FollowListScreen userId={1} />);
    await screen.findByText('ann');

    fireEvent.press(screen.getByTestId('remove-follower-2'));
    fireEvent.press(screen.getByTestId('remove-follower-2'));
    await act(async () => {
      resolve();
    });

    expect(screen.queryByText('ann')).toBeNull();
    expect(mockRemoveFollower).toHaveBeenCalledTimes(1);
  });
});
