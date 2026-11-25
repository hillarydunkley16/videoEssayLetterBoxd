/**
 * Owner actions on the log page: a top-right three-dots menu (owner only) with
 * Edit (reopens logVideoModal pre-filled) and Delete (inline confirm, then one
 * delete request and back to the previous screen).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    back: (...a: unknown[]) => mockBack(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
    canGoBack: () => true,
  },
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

let mockIsMine = true;
const mockDeleteLog = jest.fn();
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
  owner: 'me',
  owner_id: 1,
  owner_image: null,
  is_mine: mockIsMine,
  is_liked: false,
  likes: [],
  comments: [],
});
jest.mock('@/src/api/logs', () => ({
  fetchALog: async () => makeLog(),
  likeLog: jest.fn(),
  commentOnLog: jest.fn(),
  deleteLog: (...a: unknown[]) => mockDeleteLog(...a),
}));
jest.mock('@/src/api/users', () => ({
  fetchProfile: async () => ({ watchList: { public_id: 'w', essays: [] } }),
}));
jest.mock('@/src/api/collection', () => ({ addToWatchlist: jest.fn(), removeFromWatchlist: jest.fn() }));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));

import LogInfo from '../logInfo';

jest.setTimeout(20000);

async function renderLoaded() {
  render(<LogInfo id="log-1" />);
  await screen.findByText('nice');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsMine = true;
  mockDeleteLog.mockResolvedValue({});
});

it("shows no actions menu on someone else's log", async () => {
  mockIsMine = false;
  await renderLoaded();
  expect(screen.queryByLabelText('Log options')).toBeNull();
});

it('Edit opens the pre-filled log modal for this log', async () => {
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Log options'));
  fireEvent.press(await screen.findByText('Edit'));
  expect(mockPush).toHaveBeenCalledWith('/logVideoModal?logId=log-1');
});

it('Delete asks for confirmation before deleting', async () => {
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Log options'));
  fireEvent.press(await screen.findByText('Delete'));
  expect(mockDeleteLog).not.toHaveBeenCalled();
  expect(await screen.findByText(/delete this log/i)).toBeTruthy();
});

it('deletes once after confirm (even double-tapped), then goes back', async () => {
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Log options'));
  fireEvent.press(await screen.findByText('Delete'));
  const confirm = await screen.findByLabelText('Confirm delete log');
  fireEvent.press(confirm);
  fireEvent.press(confirm);
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(mockDeleteLog).toHaveBeenCalledTimes(1);
  expect(mockDeleteLog).toHaveBeenCalledWith('log-1', 'token', expect.any(Function));
});

it('cancel dismisses the confirm without deleting', async () => {
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Log options'));
  fireEvent.press(await screen.findByText('Delete'));
  fireEvent.press(await screen.findByLabelText('Cancel delete log'));
  expect(mockDeleteLog).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText(/delete this log/i)).toBeNull());
});

it('keeps the page usable and shows an error if delete fails', async () => {
  mockDeleteLog.mockRejectedValueOnce(new Error('403'));
  await renderLoaded();
  fireEvent.press(screen.getByLabelText('Log options'));
  fireEvent.press(await screen.findByText('Delete'));
  fireEvent.press(await screen.findByLabelText('Confirm delete log'));
  expect(await screen.findByText(/couldn't delete/i)).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
});
