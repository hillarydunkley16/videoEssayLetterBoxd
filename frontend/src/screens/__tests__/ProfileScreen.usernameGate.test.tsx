/**
 * ProfileScreen mounts the real UsernameGateBanner (not stubbed) so this confirms it actually
 * shows up in the profile tab per SPEC-username-onboarding.md decision 4. T5 covers the
 * banner's own logic in isolation; this is the render-check T6 calls for.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (cb: () => void) => { const R = require('react'); R.useEffect(() => { cb(); }, []); },
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token', isLoaded: true, isSignedIn: true }),
  useUser: () => ({ user: { username: 'me', imageUrl: null } }),
  useClerk: () => ({ signOut: jest.fn() }),
}));

let mockHasUsername = false;
jest.mock('@/src/api/users', () => ({
  fetchProfile: async () => ({
    user: { id: 1 }, user_logs: [], followers_count: 0, following_count: 0,
    watchList: { public_id: 'w', essays: [] },
    has_username: mockHasUsername,
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

describe('ProfileScreen username gate', () => {
  it('mounts the nudge when the viewer has no username', async () => {
    mockHasUsername = false;
    render(<ProfileScreen />);
    expect(await screen.findByTestId('username-gate-banner')).toBeTruthy();
  });

  it('mounts nothing when the viewer already has a username', async () => {
    mockHasUsername = true;
    render(<ProfileScreen />);
    await waitFor(() => screen.getByLabelText('Settings'));
    expect(screen.queryByTestId('username-gate-banner')).toBeNull();
  });
});
