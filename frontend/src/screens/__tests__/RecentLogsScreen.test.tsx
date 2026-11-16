/**
 * The "everyone" feed. The "popular this week" strip above it is secondary: the feed rows must
 * show as soon as the logs arrive, and the popular request (public, no token needed) must not
 * gate them. On the live site the authenticated popular call took ~2.8s while rows waited on it.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';

const mockGetToken = jest.fn();

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: mockGetToken, isSignedIn: true, isLoaded: true }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/components/ui/LogRow', () => {
  const { Text: T } = require('react-native');
  return { LogRow: ({ item }: { item: { public_id: string } }) => <T>{`LOG ${item.public_id}`}</T> };
});
jest.mock('../../api/logs', () => ({ fetchLogs: jest.fn(), fetchLogsPage: jest.fn() }));
jest.mock('../../api/videos', () => ({
  fetchPopularVideoEssays: jest.fn(),
  fetchPopularVideoEssaysPublic: jest.fn(),
}));

import RecentLogsScreen from '../RecentLogsScreen';
import { fetchLogs, fetchLogsPage } from '../../api/logs';
import { fetchPopularVideoEssays, fetchPopularVideoEssaysPublic } from '../../api/videos';

jest.setTimeout(20000);

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });
const logsPage = page([{ public_id: 'l1' }, { public_id: 'l2' }]);
const popularPage = page([
  { public_id: 'p1', title: 'POPULAR ESSAY', thumbnail: null, channel_name: 'c', log_count: 3 },
]);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetToken.mockResolvedValue('tok');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RecentLogsScreen initial load', () => {
  it('shows the feed rows as soon as the logs arrive, without waiting for the popular strip', async () => {
    const popular = deferred<unknown>(); // never resolves during this test
    (fetchLogs as jest.Mock).mockResolvedValue(logsPage);
    (fetchPopularVideoEssaysPublic as jest.Mock).mockReturnValue(popular.promise);

    render(<RecentLogsScreen />);

    expect(await screen.findByText('LOG l1')).toBeTruthy();
    expect(screen.getByText('LOG l2')).toBeTruthy();
    expect(screen.queryByText('POPULAR ESSAY')).toBeNull();
  });

  it('fills in the popular strip when it arrives later', async () => {
    const popular = deferred<unknown>();
    (fetchLogs as jest.Mock).mockResolvedValue(logsPage);
    (fetchPopularVideoEssaysPublic as jest.Mock).mockReturnValue(popular.promise);

    render(<RecentLogsScreen />);
    await screen.findByText('LOG l1');

    await act(async () => {
      popular.resolve(popularPage);
    });
    expect(await screen.findByText('POPULAR ESSAY')).toBeTruthy();
  });

  it('fetches the popular strip without a token (the endpoint is public; auth only adds server cost)', async () => {
    (fetchLogs as jest.Mock).mockResolvedValue(logsPage);
    (fetchPopularVideoEssaysPublic as jest.Mock).mockResolvedValue(popularPage);

    render(<RecentLogsScreen />);
    await screen.findByText('LOG l1');

    expect(fetchPopularVideoEssaysPublic).toHaveBeenCalledWith();
    expect(fetchPopularVideoEssays).not.toHaveBeenCalled();
  });

  it('starts the popular request without waiting for the token', async () => {
    const token = deferred<string>();
    mockGetToken.mockReturnValue(token.promise);
    (fetchLogs as jest.Mock).mockResolvedValue(logsPage);
    (fetchPopularVideoEssaysPublic as jest.Mock).mockResolvedValue(popularPage);

    render(<RecentLogsScreen />);

    expect(fetchPopularVideoEssaysPublic).toHaveBeenCalledTimes(1);
    expect(fetchLogs).not.toHaveBeenCalled();

    await act(async () => {
      token.resolve('tok');
    });
    expect(fetchLogs).toHaveBeenCalledWith('tok');
  });

  it('still shows the feed when the popular request fails', async () => {
    (fetchLogs as jest.Mock).mockResolvedValue(logsPage);
    (fetchPopularVideoEssaysPublic as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<RecentLogsScreen />);

    expect(await screen.findByText('LOG l1')).toBeTruthy();
    expect(console.error).toHaveBeenCalled();
  });
});

// The feed is paged and new logs land at the top while it is open (for example the log a new
// visitor's replay creates right as the home screen loads). That pushes the last row of page 1
// onto page 2, so the next page repeats a row already shown. Two rows with one public_id is a
// duplicate React key, which the web dev overlay reports as an error.
describe('RecentLogsScreen paging', () => {
  it('shows a row once when the next page repeats it', async () => {
    (fetchPopularVideoEssaysPublic as jest.Mock).mockResolvedValue(page([]));
    (fetchLogs as jest.Mock).mockResolvedValue({
      count: 3,
      next: 'http://api.test/logList/?page=2',
      previous: null,
      results: [{ public_id: 'l1' }, { public_id: 'l2' }],
    });
    (fetchLogsPage as jest.Mock).mockResolvedValue({
      count: 3,
      next: null,
      previous: null,
      results: [{ public_id: 'l2' }, { public_id: 'l3' }],
    });

    render(<RecentLogsScreen />);
    await screen.findByText('LOG l1');
    await act(async () => {
      await screen.UNSAFE_getAllByType(FlatList)[0].props.onEndReached();
    });

    expect(await screen.findByText('LOG l3')).toBeTruthy();
    expect(screen.getAllByText('LOG l1')).toHaveLength(1);
    expect(screen.getAllByText('LOG l2')).toHaveLength(1);
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('same key'));
  });
});
