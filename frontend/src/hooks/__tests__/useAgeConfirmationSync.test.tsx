/**
 * The age tick is made while signed out. Once the visitor has an account it is reported to the
 * server exactly once, and kept for the next app open if that fails. Signing in remounts the
 * subtree and fires several auth signals at once, so a double report is the main risk.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import { readAgeConfirmation, saveAgeConfirmation } from '@/src/lib/ageConfirmation';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGetToken = jest.fn();
let mockIsSignedIn = true;
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ isSignedIn: mockIsSignedIn, getToken: mockGetToken }),
}));

const mockRecord = jest.fn();
jest.mock('@/src/api/users', () => ({
  recordAgeConfirmation: (...a: unknown[]) => mockRecord(...a),
}));

import { useAgeConfirmationSync, __resetAgeConfirmationSyncForTests } from '../useAgeConfirmationSync';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  __resetAgeConfirmationSyncForTests();
  mockIsSignedIn = true;
  mockGetToken.mockResolvedValue('tok');
  mockRecord.mockResolvedValue({ age_confirmed_at: '2026-11-16T10:00:00Z' });
});

const settle = () => new Promise((r) => setTimeout(r, 20));

it('does nothing when signed out, and keeps the confirmation', async () => {
  mockIsSignedIn = false;
  await saveAgeConfirmation();
  renderHook(() => useAgeConfirmationSync());
  await settle();
  expect(mockRecord).not.toHaveBeenCalled();
  expect(await readAgeConfirmation()).not.toBeNull();
});

it('does nothing when signed in with no confirmation held', async () => {
  renderHook(() => useAgeConfirmationSync());
  await settle();
  expect(mockRecord).not.toHaveBeenCalled();
});

it('reports the confirmation with the session token, then clears it', async () => {
  await saveAgeConfirmation();
  renderHook(() => useAgeConfirmationSync());

  await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
  expect(mockRecord).toHaveBeenCalledWith('tok');
  await waitFor(async () => expect(await readAgeConfirmation()).toBeNull());
});

it('reports once when two sign-in signals fire together', async () => {
  await saveAgeConfirmation();
  renderHook(() => useAgeConfirmationSync());
  renderHook(() => useAgeConfirmationSync());

  await waitFor(() => expect(mockRecord).toHaveBeenCalled());
  await settle();
  expect(mockRecord).toHaveBeenCalledTimes(1);
});

it('keeps the confirmation when the server cannot be reached, and does not retry in a loop', async () => {
  await saveAgeConfirmation();
  mockRecord.mockRejectedValue(new Error('network'));
  const { rerender } = renderHook(() => useAgeConfirmationSync());

  await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
  await settle();
  rerender({});
  await settle();
  expect(mockRecord).toHaveBeenCalledTimes(1);
  expect(await readAgeConfirmation()).not.toBeNull();
});
