/**
 * "Continue with Google" button. Owns the useSSO call and its three outcomes: returning user
 * (session -> home), cancel (stay put, silent) and error (message). The new-user branch is a
 * stub until T3 — see tasks/todo-google-signin.md.
 */
import React from 'react';
import GoogleButton from '../GoogleButton';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockStartSSOFlow = jest.fn();
jest.mock('@clerk/clerk-expo', () => ({
  useSSO: () => ({ startSSOFlow: (...args: unknown[]) => mockStartSSOFlow(...args) }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn().mockResolvedValue(undefined),
  coolDownAsync: jest.fn().mockResolvedValue(undefined),
}));

const press = () => fireEvent.press(screen.getByText('Continue with Google'));

describe('GoogleButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('starts the Google SSO flow with the default redirect', async () => {
    mockStartSSOFlow.mockResolvedValue({ authSessionResult: { type: 'dismiss' } });
    render(<GoogleButton />);
    press();
    await waitFor(() => expect(mockStartSSOFlow).toHaveBeenCalledTimes(1));
    expect(mockStartSSOFlow).toHaveBeenCalledWith({ strategy: 'oauth_google' });
  });

  it('does nothing when disabled, and says so to screen readers', () => {
    render(<GoogleButton disabled />);
    press();
    expect(mockStartSSOFlow).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue with Google' }).props.accessibilityState.disabled).toBe(true);
  });

  it('calls startSSOFlow synchronously from the press (popup blockers)', () => {
    mockStartSSOFlow.mockReturnValue(new Promise(() => {}));
    render(<GoogleButton />);
    press();
    expect(mockStartSSOFlow).toHaveBeenCalledTimes(1);
  });

  it('activates the session then goes home for a returning user', async () => {
    const order: string[] = [];
    const setActive = jest.fn(async () => {
      order.push('setActive');
    });
    mockReplace.mockImplementation(() => order.push('replace'));
    mockStartSSOFlow.mockResolvedValue({
      createdSessionId: 'sess_1',
      setActive,
      authSessionResult: { type: 'success' },
    });
    render(<GoogleButton />);
    press();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(setActive).toHaveBeenCalledWith({ session: 'sess_1' });
    expect(order).toEqual(['setActive', 'replace']);
  });

  it('stays put with no error when the user cancels', async () => {
    mockStartSSOFlow.mockResolvedValue({ authSessionResult: { type: 'dismiss' } });
    render(<GoogleButton />);
    press();
    await waitFor(() => expect(mockStartSSOFlow).toHaveBeenCalled());
    await act(async () => {});
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId('google-error')).toBeNull();
  });

  it('sends a brand-new Google user to choose-username without a session', async () => {
    const setActive = jest.fn();
    mockStartSSOFlow.mockResolvedValue({
      createdSessionId: null,
      setActive,
      signUp: { status: 'missing_requirements' },
      authSessionResult: { type: 'success' },
    });
    render(<GoogleButton />);
    press();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/choose-username'));
    expect(setActive).not.toHaveBeenCalled();
  });

  it('does not go to choose-username when the user cancelled mid-flow', async () => {
    mockStartSSOFlow.mockResolvedValue({
      createdSessionId: null,
      signUp: { status: 'missing_requirements' },
      authSessionResult: { type: 'dismiss' },
    });
    render(<GoogleButton />);
    press();
    await waitFor(() => expect(mockStartSSOFlow).toHaveBeenCalled());
    await act(async () => {});
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the Clerk error message when the flow throws', async () => {
    mockStartSSOFlow.mockRejectedValue({
      errors: [{ code: 'x', longMessage: 'Google is unavailable right now.' }],
    });
    render(<GoogleButton />);
    press();
    expect(await screen.findByText('Google is unavailable right now.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('starts one flow for a double tap', async () => {
    let resolveFlow: (v: unknown) => void = () => {};
    mockStartSSOFlow.mockReturnValue(new Promise((r) => (resolveFlow = r)));
    render(<GoogleButton />);
    press();
    press();
    expect(mockStartSSOFlow).toHaveBeenCalledTimes(1);
    await act(async () => resolveFlow({ authSessionResult: { type: 'dismiss' } }));
    // Once the flow ends the button works again.
    mockStartSSOFlow.mockResolvedValue({ authSessionResult: { type: 'dismiss' } });
    press();
    await waitFor(() => expect(mockStartSSOFlow).toHaveBeenCalledTimes(2));
  });

  it('renders an "or" divider below the button', () => {
    render(<GoogleButton />);
    expect(screen.getByText('Continue with Google')).toBeTruthy();
    expect(screen.getByText('or')).toBeTruthy();
  });
});
