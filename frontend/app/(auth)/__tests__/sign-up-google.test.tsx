/**
 * Sign-up page: the Google button sits above the email form, same as sign-in
 * (SPEC-google-signin.md decision 4), and the email form is still there.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Page from '../sign-up';

jest.mock('@clerk/clerk-expo', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: {}, setActive: jest.fn() }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn().mockResolvedValue(undefined),
  coolDownAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/src/api/users', () => ({ checkUsernameAvailability: jest.fn() }));

describe('sign-up Google button', () => {
  it('renders above the form fields', () => {
    render(<Page />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Continue with Google')).toBeGreaterThan(-1);
    expect(tree.indexOf('Continue with Google')).toBeLessThan(tree.indexOf('First Name'));
  });

  it('keeps the email form', () => {
    render(<Page />);
    expect(screen.getByPlaceholderText('Enter email')).toBeTruthy();
    expect(screen.getByTestId('signup-submit')).toBeTruthy();
  });
});
