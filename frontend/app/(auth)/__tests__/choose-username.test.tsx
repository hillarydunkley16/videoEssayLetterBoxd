/**
 * choose-username: where a brand-new Google user picks the username Clerk still needs.
 * No session exists until it's saved; Cancel abandons the half-finished sign-up
 * (SPEC-google-signin.md resolved question 1).
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Page from '../choose-username';

const mockUpdate = jest.fn();
const mockSetActive = jest.fn();
let mockSignUp: { status: string; update: (...a: unknown[]) => unknown } | null;
jest.mock('@clerk/clerk-expo', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: mockSignUp, setActive: mockSetActive }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    useRouter: () => ({ replace: mockReplace }),
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  };
});

const mockCheck = jest.fn();
jest.mock('@/src/api/users', () => ({
  checkUsernameAvailability: (...args: unknown[]) => mockCheck(...args),
}));

const type = (text: string) => fireEvent.changeText(screen.getByPlaceholderText('Enter username'), text);
const submit = () => screen.getByTestId('choose-username-submit');
const tick = () => fireEvent.press(screen.getByRole('checkbox', { name: 'I confirm I am 16 or older' }));
const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });

describe('choose-username', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp = { status: 'missing_requirements', update: (...a) => mockUpdate(...a) };
    mockCheck.mockResolvedValue({ available: true, suggestions: [] });
  });

  it('redirects to sign-in when there is no sign-up waiting on a username', () => {
    mockSignUp = { status: 'complete', update: mockUpdate };
    render(<Page />);
    expect(screen.getByText('redirect:/sign-in')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Enter username')).toBeNull();
  });

  it('disables submit while the check runs and for a taken name', async () => {
    mockCheck.mockResolvedValue({ available: false, suggestions: ['jane_doe'] });
    render(<Page />);
    expect(submit().props.accessibilityState?.disabled).toBe(true);
    type('janedoe');
    expect(submit().props.accessibilityState?.disabled).toBe(true); // checking
    expect(await screen.findByText(/taken/i)).toBeTruthy();
    expect(submit().props.accessibilityState?.disabled).toBe(true);
  });

  it('fills the field from a suggestion', async () => {
    mockCheck.mockResolvedValueOnce({ available: false, suggestions: ['jane_doe'] });
    render(<Page />);
    type('janedoe');
    fireEvent.press(await screen.findByText('jane_doe'));
    expect(screen.getByPlaceholderText('Enter username').props.value).toBe('jane_doe');
  });

  it('saves the username, activates the session, then goes home', async () => {
    const order: string[] = [];
    mockUpdate.mockImplementation(async () => {
      order.push('update');
      return { status: 'complete', createdSessionId: 'sess_9' };
    });
    mockSetActive.mockImplementation(async () => order.push('setActive'));
    mockReplace.mockImplementation(() => order.push('replace'));
    render(<Page />);
    type('janedoe');
    await screen.findByText(/available/i);
    tick();
    fireEvent.press(submit());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockUpdate).toHaveBeenCalledWith({ username: 'janedoe' });
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_9' });
    expect(order).toEqual(['update', 'setActive', 'replace']);
  });

  it('shows a Clerk error inline and stays put', async () => {
    mockUpdate.mockRejectedValue({ errors: [{ code: 'form_identifier_exists', longMessage: 'That username is taken.' }] });
    render(<Page />);
    type('janedoe');
    await screen.findByText(/available/i);
    tick();
    fireEvent.press(submit());
    expect(await screen.findByText('That username is taken.')).toBeTruthy();
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not let a user in when Clerk says the sign-up is still incomplete', async () => {
    mockUpdate.mockResolvedValue({ status: 'missing_requirements', createdSessionId: null });
    render(<Page />);
    type('janedoe');
    await screen.findByText(/available/i);
    tick();
    fireEvent.press(submit());
    await wait();
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalledWith('/');
    expect(screen.getByText(/couldn.t finish/i)).toBeTruthy();
  });

  it('asks for the age confirmation, unchecked, and keeps Continue off until it is ticked', async () => {
    render(<Page />);
    expect(screen.getByRole('checkbox', { name: 'I confirm I am 16 or older' }).props.accessibilityState.checked).toBe(false);
    type('janedoe');
    await screen.findByText(/available/i);
    expect(submit().props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(submit());
    expect(mockUpdate).not.toHaveBeenCalled();

    tick();
    expect(submit().props.accessibilityState?.disabled).toBe(false);
    tick();
    expect(submit().props.accessibilityState?.disabled).toBe(true);
  });

  it('Cancel goes to sign-in without saving or activating anything', () => {
    render(<Page />);
    type('janedoe');
    fireEvent.press(screen.getByText('Cancel'));
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSetActive).not.toHaveBeenCalled();
  });
});
