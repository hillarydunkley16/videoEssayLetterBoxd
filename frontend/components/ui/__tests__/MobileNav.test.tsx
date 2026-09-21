/**
 * Mobile bottom tab bar.
 *
 * Home · Lists · Log (+) · Profile, in that order, with no Search tab. Log opens the search
 * screen in log mode with a fresh `focus` value so the input grabs the keyboard each tap.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockPathname = '/';
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    setParams: (...args: unknown[]) => mockSetParams(...args),
  },
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

import { MobileNav } from '../MobileNav';

jest.setTimeout(20000);

function selectedLabels() {
  return screen
    .getAllByRole('button')
    .filter((el) => el.props.accessibilityState?.selected)
    .map((el) => el.props.accessibilityLabel);
}

beforeEach(() => {
  mockPush.mockClear();
  mockSetParams.mockClear();
  mockPathname = '/';
  mockParams = {};
});

describe('MobileNav', () => {
  it('shows Home, Lists, Log, Profile in order and no Search tab', () => {
    render(<MobileNav />);

    const labels = screen.getAllByRole('button').map((el) => el.props.accessibilityLabel);
    expect(labels).toEqual(['Home', 'Lists', 'Log', 'Profile']);
    expect(screen.queryByText('Search')).toBeNull();
  });

  it.each([
    ['/', {}, 'Home'],
    ['/lists', {}, 'Lists'],
    ['/profile', {}, 'Profile'],
    ['/search', { mode: 'log' }, 'Log'],
  ])('marks the right tab selected for %s %j', (path, params, expected) => {
    mockPathname = path;
    mockParams = params as Record<string, string>;
    render(<MobileNav />);

    expect(selectedLabels()).toEqual([expected]);
  });

  it('does not mark Log selected on plain search (top-bar search)', () => {
    mockPathname = '/search';
    render(<MobileNav />);

    expect(selectedLabels()).toEqual([]);
  });

  it('Log opens search in log mode with a focus signal', () => {
    render(<MobileNav />);
    fireEvent.press(screen.getByTestId('tab-log'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/search',
      params: { mode: 'log', focus: expect.any(String) },
    });
  });

  it('Log on the search screen updates params instead of stacking another search', () => {
    mockPathname = '/search';
    render(<MobileNav />);
    fireEvent.press(screen.getByTestId('tab-log'));

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSetParams).toHaveBeenCalledWith({ mode: 'log', focus: expect.any(String) });
  });
});
