/**
 * The sheet that asks a visitor to make an account once they have rated an essay. It shows the
 * log they are about to save and sends them to the existing Clerk screens, never rebuilding them.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AccountSheet from '../AccountSheet';

const calls: string[] = [];
const mockPush = jest.fn((href: string) => calls.push(`push:${href}`));
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
const mockCreate = jest.fn();
const mockPrepare = jest.fn();
const mockAttempt = jest.fn();
const mockSetActive = jest.fn();
jest.mock('@clerk/clerk-expo', () => ({
  useSignUp: () => ({
    isLoaded: true,
    signUp: {
      create: (...a: unknown[]) => mockCreate(...a),
      prepareEmailAddressVerification: (...a: unknown[]) => mockPrepare(...a),
      attemptEmailAddressVerification: (...a: unknown[]) => mockAttempt(...a),
    },
    setActive: (...a: unknown[]) => mockSetActive(...a),
  }),
}));
let mockUsername = { checking: false, available: null as boolean | null, suggestions: [] as string[] };
jest.mock('@/src/hooks/useUsernameAvailability', () => ({
  useUsernameAvailability: () => mockUsername,
}));
jest.mock('../GoogleButton', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>GOOGLE</Text> };
});

const log = { title: 'How to Do Visual Comedy', thumbnail: 'https://img.test/t.jpg', rating: 4 };

function setup(overrides: Partial<React.ComponentProps<typeof AccountSheet>> = {}) {
  calls.length = 0;
  const onBack = jest.fn(() => calls.push('back'));
  const onDismiss = jest.fn(() => calls.push('dismiss'));
  render(<AccountSheet visible {...log} onBack={onBack} onDismiss={onDismiss} {...overrides} />);
  return { onBack, onDismiss };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsername = { checking: false, available: null, suggestions: [] };
  mockCreate.mockResolvedValue({});
  mockPrepare.mockResolvedValue({});
  mockAttempt.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_1' });
  mockSetActive.mockResolvedValue(undefined);
});

function openEmailForm() {
  fireEvent.press(screen.getByRole('button', { name: 'Create account with email' }));
}

function fillDetails() {
  fireEvent.changeText(screen.getByLabelText('First name'), 'Hillary');
  fireEvent.changeText(screen.getByLabelText('Last name'), 'Dunkley');
  fireEvent.changeText(screen.getByLabelText('Username'), 'hillary4');
  fireEvent.changeText(screen.getByLabelText('Email address'), 'h@example.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'hunter2hunter2!');
}

describe('AccountSheet', () => {
  it('shows the log that is waiting to be saved', () => {
    setup();
    expect(screen.getByText('Create an account to save it')).toBeTruthy();
    expect(screen.getByText('How to Do Visual Comedy')).toBeTruthy();
    expect(screen.getByLabelText('Rated 4 out of 5')).toBeTruthy();
  });

  it('offers Google sign-in', () => {
    setup();
    expect(screen.getByText('GOOGLE')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    setup({ visible: false });
    expect(screen.queryByText('Create an account to save it')).toBeNull();
  });

  it('opens the email form in the same sheet instead of leaving the page', () => {
    const { onDismiss } = setup();
    openEmailForm();
    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByText('How to Do Visual Comedy')).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('goes back from the email form to the choices', () => {
    setup();
    openEmailForm();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Create an account to save it')).toBeTruthy();
  });

  it('keeps Continue off until the required fields are filled and the username is not taken', () => {
    setup();
    openEmailForm();
    const disabled = () => screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled;
    expect(disabled()).toBe(true);
    fillDetails();
    expect(disabled()).toBe(false);
  });

  it('keeps Continue off until the password has a number and a special character', () => {
    setup();
    openEmailForm();
    fillDetails();
    const disabled = () => screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled;
    fireEvent.changeText(screen.getByLabelText('Password'), 'hunterhunter!');
    expect(disabled()).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Password'), 'hunter2hunter');
    expect(disabled()).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Password'), 'hunter2hunter!');
    expect(disabled()).toBe(false);
  });

  it('lists the password rules under the password field', () => {
    setup();
    openEmailForm();
    expect(screen.getByText('Includes a number')).toBeTruthy();
    expect(screen.getByText('Includes a special character')).toBeTruthy();
  });

  it('blocks Continue when the username is known to be taken, and offers suggestions', () => {
    mockUsername = { checking: false, available: false, suggestions: ['hillary5'] };
    setup();
    openEmailForm();
    fillDetails();
    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByText('hillary5'));
    expect(screen.getByLabelText('Username').props.value).toBe('hillary5');
  });

  it('creates the sign-up, sends the code and shows the verify step in the same sheet', async () => {
    setup();
    openEmailForm();
    fillDetails();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByText('Check your email');
    expect(mockCreate).toHaveBeenCalledWith({
      emailAddress: 'h@example.com',
      password: 'hunter2hunter2!',
      firstName: 'Hillary',
      lastName: 'Dunkley',
      username: 'hillary4',
    });
    expect(mockPrepare).toHaveBeenCalledWith({ strategy: 'email_code' });
    expect(screen.getByText('How to Do Visual Comedy')).toBeTruthy();
  });

  it('shows the Clerk error above the form and stays on the details step', async () => {
    mockCreate.mockRejectedValue({ errors: [{ message: 'That email is already taken', longMessage: 'That email is already taken' }] });
    setup();
    openEmailForm();
    fillDetails();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/already taken/)).toBeTruthy();
    expect(screen.getByText('Create your account')).toBeTruthy();
  });

  it('verifies the code, activates the session and closes the sheet', async () => {
    const { onDismiss } = setup();
    openEmailForm();
    fillDetails();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Check your email');

    fireEvent.changeText(screen.getByLabelText('Verification code'), '482100');
    fireEvent.press(screen.getByRole('button', { name: 'Verify and save my log' }));

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(mockAttempt).toHaveBeenCalledWith({ code: '482100' });
    expect(mockSetActive.mock.calls[0][0].session).toBe('sess_1');
  });

  it('keeps the sheet open with an error when the code is wrong', async () => {
    mockAttempt.mockRejectedValue({ errors: [{ message: 'Incorrect code', longMessage: 'Incorrect code' }] });
    const { onDismiss } = setup();
    openEmailForm();
    fillDetails();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Check your email');
    fireEvent.changeText(screen.getByLabelText('Verification code'), '000000');
    fireEvent.press(screen.getByRole('button', { name: 'Verify and save my log' }));

    expect(await screen.findByText(/Incorrect code/)).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('goes back from verify to the details with what was typed kept', async () => {
    setup();
    openEmailForm();
    fillDetails();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Check your email');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Email address').props.value).toBe('h@example.com');
  });

  it('starts from the choices again when the sheet is reopened', () => {
    const { rerender } = render(<AccountSheet visible {...log} onBack={jest.fn()} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Create account with email' }));
    rerender(<AccountSheet visible={false} {...log} onBack={jest.fn()} onDismiss={jest.fn()} />);
    rerender(<AccountSheet visible {...log} onBack={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText('Create an account to save it')).toBeTruthy();
  });

  it('closes itself, then opens the existing sign-in screen for Log in', () => {
    setup();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(calls).toEqual(['dismiss', 'push:/(auth)/sign-in']);
  });

  it('goes back to the rating without navigating', () => {
    const { onBack } = setup();
    fireEvent.press(screen.getByRole('button', { name: 'Back to rating' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
