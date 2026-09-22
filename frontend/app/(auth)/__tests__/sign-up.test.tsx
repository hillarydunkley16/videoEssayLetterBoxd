/**
 * Sign-up page. The username field is live-checked inline (debounced, with suggestions when
 * taken) rather than only validated on submit — see SPEC-username-onboarding.md decision 1.
 * The other four fields and the email-verification step are unchanged.
 */
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockSignUpCreate = jest.fn();
const mockPrepareEmailAddressVerification = jest.fn();
const mockSignUp = {
  create: (...args: unknown[]) => mockSignUpCreate(...args),
  prepareEmailAddressVerification: (...args: unknown[]) => mockPrepareEmailAddressVerification(...args),
};
jest.mock('@clerk/clerk-expo', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: mockSignUp, setActive: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockCheckUsernameAvailability = jest.fn();
jest.mock('@/src/api/users', () => ({
  checkUsernameAvailability: (...args: unknown[]) => mockCheckUsernameAvailability(...args),
}));

import Page from '../sign-up';

function fillRequiredFieldsExceptUsername() {
  fireEvent.changeText(screen.getByPlaceholderText('Enter first name'), 'Jane');
  fireEvent.changeText(screen.getByPlaceholderText('Enter last name'), 'Doe');
  fireEvent.changeText(screen.getByPlaceholderText('Enter email'), 'jane@example.com');
  fireEvent.changeText(screen.getByPlaceholderText('Enter password'), 'hunter22');
}

describe('sign-up username live check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not check a candidate under 3 characters', async () => {
    render(<Page />);
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'ja');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(mockCheckUsernameAvailability).not.toHaveBeenCalled();
  });

  it('checks the username after the user stops typing (debounced)', async () => {
    mockCheckUsernameAvailability.mockResolvedValue({ available: true, suggestions: [] });
    render(<Page />);
    const field = screen.getByPlaceholderText('Enter username');
    fireEvent.changeText(field, 'j');
    fireEvent.changeText(field, 'ja');
    fireEvent.changeText(field, 'jan');
    fireEvent.changeText(field, 'jane');

    await waitFor(() => expect(mockCheckUsernameAvailability).toHaveBeenCalledWith('jane'));
    expect(mockCheckUsernameAvailability).toHaveBeenCalledTimes(1);
  });

  it('shows an available confirmation when the username is free', async () => {
    mockCheckUsernameAvailability.mockResolvedValue({ available: true, suggestions: [] });
    render(<Page />);
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'janedoe');

    expect(await screen.findByText(/available/i)).toBeTruthy();
  });

  it('shows suggestions when the username is taken, tappable to fill the field', async () => {
    mockCheckUsernameAvailability.mockResolvedValue({
      available: false,
      suggestions: ['janedoe1', 'janedoe2', 'janedoe_'],
    });
    render(<Page />);
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'janedoe');

    expect(await screen.findByText('janedoe1')).toBeTruthy();
    expect(screen.getByText('janedoe2')).toBeTruthy();
    expect(screen.getByText('janedoe_')).toBeTruthy();

    mockCheckUsernameAvailability.mockClear();
    mockCheckUsernameAvailability.mockResolvedValue({ available: true, suggestions: [] });
    fireEvent.press(screen.getByText('janedoe1'));
    expect(screen.getByPlaceholderText('Enter username').props.value).toBe('janedoe1');
  });

  it('drops a slow answer to an earlier candidate', async () => {
    let resolveJane: (value: unknown) => void = () => {};
    mockCheckUsernameAvailability.mockImplementation((candidate: string) =>
      candidate === 'jane'
        ? new Promise((resolve) => { resolveJane = resolve; })
        : Promise.resolve({ available: false, suggestions: ['benx1', 'benx2', 'benx3'] }),
    );
    render(<Page />);
    const field = screen.getByPlaceholderText('Enter username');
    fireEvent.changeText(field, 'jane');
    await waitFor(() => expect(mockCheckUsernameAvailability).toHaveBeenCalledWith('jane'));

    fireEvent.changeText(field, 'ben');
    expect(await screen.findByText('benx1')).toBeTruthy();

    await act(async () => {
      resolveJane({ available: true, suggestions: [] });
    });

    expect(screen.queryByText(/available/i)).toBeNull();
    expect(screen.getByText('benx1')).toBeTruthy();
  });

  it('disables submit while the username is empty', () => {
    render(<Page />);
    fillRequiredFieldsExceptUsername();
    expect(screen.getByTestId('signup-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('disables submit while the check is in flight', async () => {
    let resolveCheck: (value: unknown) => void = () => {};
    mockCheckUsernameAvailability.mockImplementation(
      () => new Promise((resolve) => { resolveCheck = resolve; }),
    );
    render(<Page />);
    fillRequiredFieldsExceptUsername();
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'janedoe');
    await waitFor(() => expect(mockCheckUsernameAvailability).toHaveBeenCalled());

    expect(screen.getByTestId('signup-submit').props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      resolveCheck({ available: true, suggestions: [] });
    });
    expect(screen.getByTestId('signup-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('disables submit while the username is known taken', async () => {
    mockCheckUsernameAvailability.mockResolvedValue({
      available: false,
      suggestions: ['janedoe1', 'janedoe2', 'janedoe3'],
    });
    render(<Page />);
    fillRequiredFieldsExceptUsername();
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'janedoe');
    await screen.findByText('janedoe1');

    expect(screen.getByTestId('signup-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('enables submit once the username is confirmed available and the other fields are filled', async () => {
    mockCheckUsernameAvailability.mockResolvedValue({ available: true, suggestions: [] });
    render(<Page />);
    fillRequiredFieldsExceptUsername();
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'janedoe');
    await screen.findByText(/available/i);

    expect(screen.getByTestId('signup-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('does not block submit when the availability check errors — Clerk is still the final check', async () => {
    mockCheckUsernameAvailability.mockRejectedValue(new Error('network down'));
    render(<Page />);
    fillRequiredFieldsExceptUsername();
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'janedoe');
    await waitFor(() => expect(mockCheckUsernameAvailability).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('signup-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('still sends username to signUp.create on submit, unchanged', async () => {
    mockCheckUsernameAvailability.mockResolvedValue({ available: true, suggestions: [] });
    mockSignUpCreate.mockResolvedValue({});
    mockPrepareEmailAddressVerification.mockResolvedValue({});
    render(<Page />);
    fillRequiredFieldsExceptUsername();
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'janedoe');
    await screen.findByText(/available/i);

    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() =>
      expect(mockSignUpCreate).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'janedoe' }),
      ),
    );
  });
});
