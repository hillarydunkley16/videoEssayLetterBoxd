/**
 * Settings screen: sign out signs out via Clerk and returns to `/`.
 * Clerk and navigation are stubbed.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: () => mockBack() },
}));

const mockSignOut = jest.fn();
jest.mock('@clerk/clerk-expo', () => ({
  useClerk: () => ({ signOut: mockSignOut }),
  useUser: () => ({ user: null }),
}));

jest.mock('@/src/hooks/useChangeProfilePhoto', () => ({
  useChangeProfilePhoto: () => ({ changePhoto: jest.fn(), error: null }),
}));

jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});

import SettingsScreen from '@/src/screens/SettingsScreen';

jest.setTimeout(20000);

beforeEach(() => jest.clearAllMocks());

describe('SettingsScreen', () => {
  it('signs out then replaces to /', async () => {
    mockSignOut.mockResolvedValue(undefined);
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Sign out'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when sign out fails', async () => {
    mockSignOut.mockRejectedValue(new Error('boom'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Sign out'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('back returns to the previous screen', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
