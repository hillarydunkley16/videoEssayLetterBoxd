/**
 * Own-profile header shows a gear that opens Settings; the old header
 * "Sign out" is gone. Clerk, network and navigation are stubbed.
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
jest.mock('@/src/api/users', () => ({
  fetchProfile: async () => ({
    user: { id: 1 }, user_logs: [], followers_count: 0, following_count: 0,
    watchList: { public_id: 'w', essays: [] },
  }),
  updateProfileImageAPI: jest.fn(),
}));
jest.mock('@/src/api/collection', () => ({ fetchUsersCollections: async () => ({ results: [] }) }));
jest.mock('@/src/api/logs', () => ({ deleteLog: jest.fn() }));
jest.mock('@/src/api/authUpdate', () => ({ useAuthUpdate: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));

import ProfileScreen from '../ProfileScreen';

jest.setTimeout(20000);

it('shows a settings gear that pushes /(tabs)/settings and no header sign out', async () => {
  render(<ProfileScreen />);
  const gear = await waitFor(() => screen.getByLabelText('Settings'));
  fireEvent.press(gear);
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
  expect(screen.queryByLabelText('Sign out')).toBeNull();
});
