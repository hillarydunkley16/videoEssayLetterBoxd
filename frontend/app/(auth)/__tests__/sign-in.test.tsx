/**
 * Sign-in page: the Google button sits above the email form (SPEC-google-signin.md decision 4).
 */
import React from 'react';
import Page from '../sign-in';
import { render, screen } from '@testing-library/react-native';

jest.mock('@clerk/clerk-expo', () => ({
  useSignIn: () => ({ isLoaded: true, signIn: {}, setActive: jest.fn() }),
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

describe('sign-in Google button', () => {
  it('renders above the email form', () => {
    render(<Page />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Continue with Google')).toBeGreaterThan(-1);
    expect(tree.indexOf('Continue with Google')).toBeLessThan(tree.indexOf('Email address'));
  });

  it('keeps the email form', () => {
    render(<Page />);
    expect(screen.getByPlaceholderText('Enter email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter password')).toBeTruthy();
  });
});
