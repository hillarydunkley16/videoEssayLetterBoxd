/**
 * Mobile top bar. Signed in it carries the search entry point; signed out it carries the app
 * name and a Log in button at the right (web gets its Log in from WebNav). It stays out of the
 * way on the auth screens, where a Log in button would point at the screen you are already on.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockPathname = '/';
let mockSignedIn = false;
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  usePathname: () => mockPathname,
}));
jest.mock('@clerk/clerk-expo', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => (mockSignedIn ? <>{children}</> : null),
  SignedOut: ({ children }: { children: React.ReactNode }) => (mockSignedIn ? null : <>{children}</>),
}));
jest.mock('../SearchField', () => ({ SearchField: () => null }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

import { MobileTopNav } from '../MobileTopNav';

beforeEach(() => {
  mockPush.mockClear();
  mockPathname = '/';
  mockSignedIn = false;
});

describe('MobileTopNav signed out', () => {
  it('shows the app name and a Log in button that opens sign-in', () => {
    render(<MobileTopNav />);
    expect(screen.getByText('watchd')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('has no search button', () => {
    render(<MobileTopNav />);
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
  });

  it.each(['/sign-in', '/sign-up', '/choose-username', '/sso-callback'])('is hidden on %s', (path) => {
    mockPathname = path;
    render(<MobileTopNav />);
    expect(screen.queryByText('watchd')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  });

  it('still shows Log in on a public page that signed-in users get no search on', () => {
    mockPathname = '/singleLog';
    render(<MobileTopNav />);
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });
});

describe('MobileTopNav signed in (unchanged)', () => {
  beforeEach(() => {
    mockSignedIn = true;
  });

  it('shows the search button and no Log in', () => {
    render(<MobileTopNav />);
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  });

  it('is hidden on the profile page', () => {
    mockPathname = '/profile';
    render(<MobileTopNav />);
    expect(screen.queryByText('watchd')).toBeNull();
  });
});
