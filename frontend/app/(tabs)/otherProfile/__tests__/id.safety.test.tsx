/**
 * Report and block on another user's profile.
 *
 * A "..." menu offers Report and Block user. Blocking asks for confirmation first, sends one
 * request even if tapped twice, then tells the feeds, shows a toast and leaves the profile. A
 * profile the server answers 404 for (blocked either way) shows a neutral message.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    back: (...a: unknown[]) => mockBack(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
    canGoBack: () => mockCanGoBack,
  },
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
  useUser: () => ({ user: { id: 'user_clerk_me' } }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
}));

const mockFetchProfile = jest.fn();
jest.mock('@/src/api/users', () => ({
  fetchAProfileById: (...args: unknown[]) => mockFetchProfile(...args),
  followUser: jest.fn(),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));

const mockBlock = jest.fn();
const mockReport = jest.fn();
jest.mock('@/src/api/safety', () => ({
  ...jest.requireActual('@/src/api/safety'),
  blockUser: (...args: unknown[]) => mockBlock(...args),
  reportContent: (...args: unknown[]) => mockReport(...args),
}));

const mockToast = jest.fn();
jest.mock('@/src/helpers/toast', () => ({ showToast: (...a: unknown[]) => mockToast(...a) }));
const mockNotify = jest.fn();
jest.mock('@/src/helpers/blockEvents', () => ({ notifyBlockChanged: () => mockNotify() }));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});

import OtherProfile from '../[id]';

jest.setTimeout(20000);

const profile = () => ({
  id: 1,
  user: { id: 7, username: 'bob', logs: null, imageUrl: '' },
  imageUrl: null,
  user_logs: [],
  followers_count: 3,
  following_count: 1,
  is_following: false,
  watchList: { id: 1, public_id: 'wl', name: "bob's Watchlist", owner: 'bob', essays: [] },
});

async function openBlockConfirm() {
  render(<OtherProfile />);
  fireEvent.press(await screen.findByLabelText('Profile options'));
  fireEvent.press(await screen.findByText('Block user'));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockCanGoBack = true;
  mockFetchProfile.mockResolvedValue(profile());
  mockBlock.mockResolvedValue(undefined);
  mockReport.mockResolvedValue({ id: 1, status: 'open' });
});

describe('report from a profile', () => {
  it('offers Report and reports the user by id', async () => {
    render(<OtherProfile />);
    fireEvent.press(await screen.findByLabelText('Profile options'));
    fireEvent.press(await screen.findByText('Report'));
    expect(await screen.findByText('Report this user')).toBeTruthy();

    fireEvent.press(await screen.findByRole('radio', { name: 'Harassment or bullying' }));
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

    await screen.findByText('Thanks for letting us know.');
    expect(mockReport.mock.calls[0][0]).toMatchObject({ targetType: 'user', targetId: 7, reason: 'harassment' });
  });
});

describe('block from a profile', () => {
  it('asks for confirmation and explains the effect before blocking', async () => {
    await openBlockConfirm();
    expect(await screen.findByText('Block bob?')).toBeTruthy();
    expect(screen.getByText(/won't see each other's logs, comments or lists/)).toBeTruthy();
    expect(screen.getByText(/won't be told/)).toBeTruthy();
    expect(mockBlock).not.toHaveBeenCalled();
  });

  it('Cancel dismisses the confirmation without blocking', async () => {
    await openBlockConfirm();
    fireEvent.press(await screen.findByLabelText('Cancel block'));
    expect(screen.queryByText('Block bob?')).toBeNull();
    expect(mockBlock).not.toHaveBeenCalled();
  });

  it('blocks once (even double-tapped), tells the feeds, toasts and goes back', async () => {
    await openBlockConfirm();
    const confirm = await screen.findByLabelText('Confirm block');
    fireEvent.press(confirm);
    fireEvent.press(confirm);

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockBlock).toHaveBeenCalledTimes(1);
    expect(mockBlock.mock.calls[0][0]).toBe(7);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith('Blocked bob');
  });

  it('goes to the home screen when there is nothing to go back to', async () => {
    mockCanGoBack = false;
    await openBlockConfirm();
    fireEvent.press(await screen.findByLabelText('Confirm block'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows an error, stays on the profile and can retry when blocking fails', async () => {
    mockBlock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined);
    await openBlockConfirm();

    fireEvent.press(await screen.findByLabelText('Confirm block'));
    await screen.findByText("Couldn't block this user. Please try again.");
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Confirm block'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockBlock).toHaveBeenCalledTimes(2);
  });
});

describe('an unavailable profile', () => {
  it('shows a neutral message when the server answers 404 (blocked either way)', async () => {
    mockFetchProfile.mockRejectedValue(new Error('API error: 404 — {"message":"Profile not found"}'));
    render(<OtherProfile />);
    expect(await screen.findByText("This profile isn't available.")).toBeTruthy();
    expect(screen.queryByText(/block/i)).toBeNull();
  });

  it('still says "Unable to load profile" for other failures', async () => {
    mockFetchProfile.mockRejectedValue(new Error('API error: 500 — boom'));
    render(<OtherProfile />);
    expect(await screen.findByText('Unable to load profile')).toBeTruthy();
  });
});
