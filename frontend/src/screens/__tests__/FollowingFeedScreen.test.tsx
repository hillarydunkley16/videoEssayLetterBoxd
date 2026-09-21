/**
 * Following feed on home.
 *
 * Renders the logs from /feed/, requests the next page (the URL DRF hands back) when the
 * end is reached, refetches page 1 on pull to refresh, and shows an empty state that links to
 * search when the viewer follows nobody. Clerk, the network and navigation are stubbed.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token', isSignedIn: true, isLoaded: true }),
}));

const mockFetchFeed = jest.fn();
const mockFetchLogsPage = jest.fn();
jest.mock('@/src/api/logs', () => ({
  fetchFollowingFeed: (...args: unknown[]) => mockFetchFeed(...args),
  fetchLogsPage: (...args: unknown[]) => mockFetchLogsPage(...args),
}));

jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: (props: Record<string, unknown>) => <Text {...props} /> };
});

import FollowingFeedScreen from '../FollowingFeedScreen';

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

function log(id: number, owner: string, title: string) {
  return {
    id,
    public_id: `log-${id}`,
    date: '2026-09-20',
    essay: `essay-${id}`,
    essay_details: { public_id: `essay-${id}`, title, thumbnail: null, duration: '10:00' },
    review_text: `review by ${owner}`,
    rating: 4,
    rewatch: false,
    owner,
    owner_id: id,
    owner_image: null,
    likes: [],
    comments: [],
  };
}

function page(results: ReturnType<typeof log>[], next: string | null = null) {
  return { count: results.length, next, previous: null, results };
}

describe('FollowingFeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the followed users\' logs', async () => {
    mockFetchFeed.mockResolvedValue(page([log(1, 'ann', 'Essay One'), log(2, 'ben', 'Essay Two')]));
    render(<FollowingFeedScreen />);

    expect(await screen.findByText(/watched Essay One/)).toBeTruthy();
    expect(screen.getByText(/watched Essay Two/)).toBeTruthy();
    expect(mockFetchFeed).toHaveBeenCalledWith('token');
  });

  it('requests the next page when the end of the list is reached', async () => {
    mockFetchFeed.mockResolvedValue(page([log(1, 'ann', 'Essay One')], 'http://api/feed/?page=2'));
    mockFetchLogsPage.mockResolvedValue(page([log(2, 'ben', 'Essay Two')]));
    render(<FollowingFeedScreen />);
    await screen.findByText(/watched Essay One/);

    fireEvent(screen.getByTestId('following-feed'), 'endReached');

    expect(await screen.findByText(/watched Essay Two/)).toBeTruthy();
    expect(mockFetchLogsPage).toHaveBeenCalledWith('http://api/feed/?page=2', 'token');
    expect(screen.getByText(/watched Essay One/)).toBeTruthy();
  });

  it('does not request another page when there is none', async () => {
    mockFetchFeed.mockResolvedValue(page([log(1, 'ann', 'Essay One')]));
    render(<FollowingFeedScreen />);
    await screen.findByText(/watched Essay One/);

    fireEvent(screen.getByTestId('following-feed'), 'endReached');

    expect(mockFetchLogsPage).not.toHaveBeenCalled();
  });

  it('pull to refresh refetches the first page and replaces the list', async () => {
    mockFetchFeed
      .mockResolvedValueOnce(page([log(1, 'ann', 'Essay One')]))
      .mockResolvedValueOnce(page([log(3, 'cat', 'Essay Three')]));
    render(<FollowingFeedScreen />);
    await screen.findByText(/watched Essay One/);

    await waitFor(() => screen.getByTestId('following-feed').props.onRefresh());

    expect(await screen.findByText(/watched Essay Three/)).toBeTruthy();
    expect(screen.queryByText(/watched Essay One/)).toBeNull();
    expect(mockFetchFeed).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state that links to people search when following nobody', async () => {
    mockFetchFeed.mockResolvedValue(page([]));
    render(<FollowingFeedScreen />);

    expect(await screen.findByText(/Follow people to see their logs here/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('feed-empty-search'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/search', params: { type: 'people' } });
  });

  it('shows the empty state rather than crashing when the request fails', async () => {
    mockFetchFeed.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<FollowingFeedScreen />);

    expect(await screen.findByText(/Follow people to see their logs here/)).toBeTruthy();
  });
});
