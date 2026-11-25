/**
 * Reporting from the log page: a "..." menu with Report on someone else's log and on each
 * comment that isn't yours, and no entry on your own log or comments.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (cb: () => void) => { const R = require('react'); R.useEffect(() => { cb(); }, []); },
}));
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
  useUser: () => ({ user: { username: 'me' } }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View };
});
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});

let mockIsMine = false;
const makeLog = () => ({
  public_id: 'log-1',
  essay_details: {
    public_id: 'essay-1', title: 'An Essay', channel_name: 'Chan', thumbnail: null,
    youtube_url: 'https://y', views: null, duration: null,
  },
  rating: 4,
  review_text: 'nice',
  rewatch: false,
  date: '2026-01-01',
  owner: 'someone',
  owner_id: 2,
  owner_image: null,
  is_mine: mockIsMine,
  is_liked: false,
  likes: [],
  comments: [
    { id: 11, user: 'me', is_mine: true, text: 'my own comment', log: 'log-1' },
    { id: 12, user: 'rudeguy', is_mine: false, text: 'their comment', log: 'log-1' },
  ],
});
jest.mock('@/src/api/logs', () => ({
  fetchALog: async () => makeLog(),
  likeLog: jest.fn(),
  commentOnLog: jest.fn(),
  deleteLog: jest.fn(),
}));
jest.mock('@/src/api/users', () => ({
  fetchProfile: async () => ({ watchList: { public_id: 'w', essays: [] } }),
}));
jest.mock('@/src/api/collection', () => ({ addToWatchlist: jest.fn(), removeFromWatchlist: jest.fn() }));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));

const mockReport = jest.fn();
jest.mock('@/src/api/safety', () => ({
  ...jest.requireActual('@/src/api/safety'),
  reportContent: (...args: unknown[]) => mockReport(...args),
}));

import LogInfo from '../logInfo';

jest.setTimeout(20000);

async function renderLoaded() {
  render(<LogInfo id="log-1" />);
  await screen.findByText('nice');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockIsMine = false;
  mockReport.mockResolvedValue({ id: 1, status: 'open' });
});

it("offers Report on someone else's log and opens the report sheet", async () => {
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Report options'));
  fireEvent.press(await screen.findByText('Report'));
  expect(await screen.findByText('Report this log')).toBeTruthy();
});

it('reports the log by its public id', async () => {
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Report options'));
  fireEvent.press(await screen.findByText('Report'));
  fireEvent.press(await screen.findByRole('radio', { name: 'Spam' }));
  fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
  await screen.findByText('Thanks for letting us know.');
  expect(mockReport.mock.calls[0][0]).toMatchObject({ targetType: 'log', targetId: 'log-1', reason: 'spam' });
});

it('has no Report entry on your own log', async () => {
  mockIsMine = true;
  await renderLoaded();
  expect(screen.queryByLabelText('Report options')).toBeNull();
  expect(screen.getByLabelText('Log options')).toBeTruthy();
});

it("offers Report on other people's comments only", async () => {
  await renderLoaded();
  expect(screen.getByLabelText('Report options for comment by rudeguy')).toBeTruthy();
  expect(screen.queryByLabelText('Report options for comment by me')).toBeNull();
});

it('reports a comment by its id', async () => {
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Report options for comment by rudeguy'));
  fireEvent.press(await screen.findByText('Report'));
  expect(await screen.findByText('Report this comment')).toBeTruthy();
  fireEvent.press(await screen.findByRole('radio', { name: 'Harassment or bullying' }));
  fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
  await screen.findByText('Thanks for letting us know.');
  expect(mockReport.mock.calls[0][0]).toMatchObject({ targetType: 'comment', targetId: 12, reason: 'harassment' });
});
