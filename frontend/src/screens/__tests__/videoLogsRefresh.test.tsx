/**
 * Quick log opens on top of a video's page and dismisses with router.back(), which
 * does not remount the page underneath. Both screens that list a video's logs must
 * therefore refetch whenever they regain focus, or the new log never shows up.
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';

let mockFocusCallback: (() => void | (() => void)) | undefined;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (cb: () => void | (() => void)) => {
    mockFocusCallback = cb;
    const R = require('react');
    R.useEffect(() => { cb(); }, [cb]);
  },
}));
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
  useUser: () => ({ user: { username: 'me' } }),
}));

const mockGetAVideoEssay = jest.fn();
jest.mock('@/src/api/videos', () => ({ getAVideoEssay: (...a: unknown[]) => mockGetAVideoEssay(...a) }));
jest.mock('../../api/videos', () => ({ getAVideoEssay: (...a: unknown[]) => mockGetAVideoEssay(...a) }));
jest.mock('@/src/api/users', () => ({
  fetchProfile: async () => ({ watchList: { public_id: 'w', essays: [] } }),
}));
jest.mock('@/src/api/collection', () => ({ addToWatchlist: jest.fn(), removeFromWatchlist: jest.fn() }));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));
jest.mock('react-native-gifted-charts', () => ({ LineChart: () => null }));
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: (props: Record<string, unknown>) => <Text {...props} /> };
});

import VideoInfoScreen from '../VideoInfoScreen';
import VideoInfoLogs from '../VideoInfoLogs';

jest.setTimeout(20000);

const video = {
  public_id: 'essay-1', title: 'An Essay', channel_name: 'Chan', thumbnail: null,
  youtube_url: 'https://y', views: null, duration: null,
};
const log = (n: number) => ({
  public_id: `log-${n}`, rating: 4, review_text: `review ${n}`, date: '2026-01-01',
  owner: 'me', owner_id: 1, owner_image: null, essay_details: video,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallback = undefined;
  mockGetAVideoEssay.mockResolvedValue({ video, logs: [log(1)], log_count: 1 });
});

describe.each([
  ['VideoInfoScreen', () => <VideoInfoScreen id="essay-1" />],
  ['VideoInfoLogs', () => <VideoInfoLogs id="essay-1" />],
])('%s', (_name, ui) => {
  it('refetches the essay and its logs when it regains focus', async () => {
    render(ui());
    await waitFor(() => expect(mockGetAVideoEssay).toHaveBeenCalledTimes(1));

    expect(mockFocusCallback).toBeDefined();
    await act(async () => { mockFocusCallback!(); });

    expect(mockGetAVideoEssay).toHaveBeenCalledTimes(2);
  });

  it('does not hand a promise back to useFocusEffect', async () => {
    render(ui());
    await waitFor(() => expect(mockGetAVideoEssay).toHaveBeenCalled());
    // useFocusEffect only accepts undefined or a cleanup function.
    expect(mockFocusCallback!()).toBeUndefined();
  });
});
