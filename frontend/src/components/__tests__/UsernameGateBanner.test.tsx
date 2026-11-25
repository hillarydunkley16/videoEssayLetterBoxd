/**
 * Soft, dismissible nudge shown to a signed-in user with no display_username — self-contained,
 * fetches its own profile via fetchProfile. See SPEC-username-onboarding.md decision 4.
 */
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

const mockFetchProfile = jest.fn();
jest.mock('@/src/api/users', () => ({
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
}));

import UsernameGateBanner from '../UsernameGateBanner';

function profile(has_username: boolean) {
  return { has_username } as any;
}

describe('UsernameGateBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing while the profile fetch is in flight', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    mockFetchProfile.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    render(<UsernameGateBanner />);

    expect(screen.queryByTestId('username-gate-banner')).toBeNull();

    await act(async () => {
      resolveFetch(profile(false));
    });
  });

  it('renders the nudge when the viewer has no username', async () => {
    mockFetchProfile.mockResolvedValue(profile(false));
    render(<UsernameGateBanner />);

    expect(await screen.findByTestId('username-gate-banner')).toBeTruthy();
  });

  it('renders nothing when the viewer already has a username', async () => {
    mockFetchProfile.mockResolvedValue(profile(true));
    render(<UsernameGateBanner />);

    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    expect(screen.queryByTestId('username-gate-banner')).toBeNull();
  });

  it('renders nothing if the profile fetch fails, rather than crashing', async () => {
    mockFetchProfile.mockRejectedValue(new Error('network down'));
    render(<UsernameGateBanner />);

    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    expect(screen.queryByTestId('username-gate-banner')).toBeNull();
  });

  it('dismiss hides the banner for the rest of this mount, without touching anything else', async () => {
    mockFetchProfile.mockResolvedValue(profile(false));
    render(<UsernameGateBanner />);
    await screen.findByTestId('username-gate-banner');

    fireEvent.press(screen.getByText(/dismiss/i));

    expect(screen.queryByTestId('username-gate-banner')).toBeNull();
  });
});
