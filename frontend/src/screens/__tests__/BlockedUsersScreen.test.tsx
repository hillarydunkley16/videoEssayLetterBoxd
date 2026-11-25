/**
 * Settings > Blocked users: lists the people you blocked, lets you unblock them (once per tap),
 * and says so when the list is empty or fails to load. Unblocking tells the feeds to reload.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ getToken: async () => 'token' }) }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});

const mockFetchBlocked = jest.fn();
const mockUnblock = jest.fn();
jest.mock('@/src/api/safety', () => ({
  fetchBlockedUsers: (...a: unknown[]) => mockFetchBlocked(...a),
  unblockUser: (...a: unknown[]) => mockUnblock(...a),
}));

const mockToast = jest.fn();
jest.mock('@/src/helpers/toast', () => ({ showToast: (...a: unknown[]) => mockToast(...a) }));
const mockNotify = jest.fn();
jest.mock('@/src/helpers/blockEvents', () => ({ notifyBlockChanged: () => mockNotify() }));

import BlockedUsersScreen from '../BlockedUsersScreen';

jest.setTimeout(20000);

const user = (id: number, username: string) => ({ id, username, imageUrl: null });
const page = (results: ReturnType<typeof user>[], next: string | null = null) => ({
  count: results.length,
  next,
  previous: null,
  results,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUnblock.mockResolvedValue(undefined);
});

it('lists the blocked users', async () => {
  mockFetchBlocked.mockResolvedValue(page([user(1, 'ann'), user(2, 'ben')]));
  render(<BlockedUsersScreen />);
  expect(await screen.findByText('ann')).toBeTruthy();
  expect(screen.getByText('ben')).toBeTruthy();
  expect(mockFetchBlocked.mock.calls[0].slice(0, 2)).toEqual([1, 'token']);
});

it('shows an empty state when nobody is blocked', async () => {
  mockFetchBlocked.mockResolvedValue(page([]));
  render(<BlockedUsersScreen />);
  expect(await screen.findByText("You haven't blocked anyone.")).toBeTruthy();
});

it('says so when the list fails to load', async () => {
  mockFetchBlocked.mockRejectedValue(new Error('boom'));
  render(<BlockedUsersScreen />);
  expect(await screen.findByText("Couldn't load your blocked users.")).toBeTruthy();
});

it('unblocks once (even double-tapped), removes the row, toasts and tells the feeds', async () => {
  mockFetchBlocked.mockResolvedValue(page([user(1, 'ann'), user(2, 'ben')]));
  render(<BlockedUsersScreen />);
  const unblock = await screen.findByLabelText('Unblock ann');

  fireEvent.press(unblock);
  fireEvent.press(unblock);

  // The first run in a cold worker is slow, so don't rely on waitFor's 1s default.
  await waitFor(() => expect(screen.queryByText('ann')).toBeNull(), { timeout: 5000 });
  expect(mockUnblock).toHaveBeenCalledTimes(1);
  expect(mockUnblock.mock.calls[0][0]).toBe(1);
  expect(mockToast).toHaveBeenCalledWith('Unblocked ann');
  expect(mockNotify).toHaveBeenCalledTimes(1);
  expect(screen.getByText('ben')).toBeTruthy();
});

it('keeps the row and shows an error when unblocking fails', async () => {
  mockFetchBlocked.mockResolvedValue(page([user(1, 'ann')]));
  mockUnblock.mockRejectedValueOnce(new Error('network'));
  render(<BlockedUsersScreen />);

  fireEvent.press(await screen.findByLabelText('Unblock ann'));

  expect(await screen.findByText("Couldn't unblock ann. Please try again.")).toBeTruthy();
  expect(screen.getByText('ann')).toBeTruthy();
  expect(mockNotify).not.toHaveBeenCalled();
});

it('loads the next page when the end is reached', async () => {
  mockFetchBlocked
    .mockResolvedValueOnce(page([user(1, 'ann')], 'next-url'))
    .mockResolvedValueOnce(page([user(2, 'ben')]));
  render(<BlockedUsersScreen />);
  await screen.findByText('ann');

  act(() => {
    screen.getByTestId('blocked-users-list').props.onEndReached?.();
  });

  expect(await screen.findByText('ben')).toBeTruthy();
  expect(mockFetchBlocked.mock.calls[1].slice(0, 2)).toEqual([2, 'token']);
});

it('does not link rows to a profile, which would be unavailable while blocked', async () => {
  mockFetchBlocked.mockResolvedValue(page([user(1, 'ann')]));
  render(<BlockedUsersScreen />);
  fireEvent.press(await screen.findByText('ann'));
  expect(mockPush).not.toHaveBeenCalled();
});
