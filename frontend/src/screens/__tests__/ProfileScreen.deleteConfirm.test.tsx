/**
 * Deleting a log from Profile is destructive and previously fired immediately on tap.
 * Tapping the "×" now shows an inline "Delete this log?" confirm with Delete/Cancel,
 * matching the expand-to-confirm pattern already used for account deletion
 * (DeleteAccountSection). The network call only fires on the explicit confirm tap.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() },
  useFocusEffect: (cb: () => void) => { const R = require('react'); R.useEffect(() => { cb(); }, []); },
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token', isLoaded: true, isSignedIn: true }),
  useUser: () => ({ user: { username: 'me', imageUrl: null } }),
  useClerk: () => ({ signOut: jest.fn() }),
}));

const log = {
  public_id: 'log-1',
  essay: 1,
  essay_details: { public_id: 'essay-1', title: 'A Video Essay', channel_name: 'Channel', thumbnail: null },
  rating: 4,
  review_text: '',
  rewatch: false,
  date: '2026-01-01',
  is_mine: true,
};

jest.mock('@/src/api/users', () => ({
  fetchProfile: async () => ({
    user: { id: 1 }, user_logs: [log], followers_count: 0, following_count: 0,
    watchList: { public_id: 'w', essays: [] },
  }),
  updateProfileImageAPI: jest.fn(),
}));
jest.mock('@/src/api/collection', () => ({ fetchUsersCollections: async () => ({ results: [] }) }));
const mockDeleteLog = jest.fn();
jest.mock('@/src/api/logs', () => ({ deleteLog: (...a: unknown[]) => mockDeleteLog(...a) }));
jest.mock('@/src/api/authUpdate', () => ({ useAuthUpdate: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));

import ProfileScreen from '../ProfileScreen';

jest.setTimeout(20000);

beforeEach(() => {
  mockDeleteLog.mockClear();
});

it('does not delete on the first tap; shows an inline confirm instead', async () => {
  render(<ProfileScreen />);
  const deleteBtn = await waitFor(() => screen.getByLabelText('Delete log'));
  fireEvent.press(deleteBtn);
  expect(mockDeleteLog).not.toHaveBeenCalled();
  expect(await screen.findByText(/delete this log/i)).toBeTruthy();
});

it('deletes only after the confirm tap', async () => {
  render(<ProfileScreen />);
  fireEvent.press(await waitFor(() => screen.getByLabelText('Delete log')));
  fireEvent.press(await screen.findByLabelText('Confirm delete log'));
  await waitFor(() => expect(mockDeleteLog).toHaveBeenCalledWith('log-1', 'token', expect.any(Function)));
});

it('cancel dismisses the confirm without deleting', async () => {
  render(<ProfileScreen />);
  fireEvent.press(await waitFor(() => screen.getByLabelText('Delete log')));
  fireEvent.press(await screen.findByLabelText('Cancel delete log'));
  expect(mockDeleteLog).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText(/delete this log/i)).toBeNull());
  expect(screen.getByLabelText('Delete log')).toBeTruthy();
});
