/**
 * SearchField focus signal.
 *
 * The mobile Log tab navigates to the search route with a `focus` param; the top-nav
 * search input (which lives outside that screen) must take focus when it appears or changes.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

const mockFocus = jest.fn();
let mockGlobalParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  usePathname: () => '/search',
  useGlobalSearchParams: () => mockGlobalParams,
}));

jest.mock('@rneui/themed', () => {
  const React = require('react');
  return {
    SearchBar: React.forwardRef(function MockSearchBar(_props: unknown, ref: React.Ref<unknown>) {
      React.useImperativeHandle(ref, () => ({ focus: mockFocus }));
      return null;
    }),
  };
});

import { SearchField } from '../SearchField';
import { Colors } from '@/constants/theme';

beforeEach(() => mockFocus.mockClear());

describe('SearchField focus param', () => {
  it('focuses the input when a focus param is present', () => {
    mockGlobalParams = { mode: 'log', focus: '1700000000000' };
    render(<SearchField theme={Colors.light} />);
    expect(mockFocus).toHaveBeenCalledTimes(1);
  });

  it('re-focuses when the focus param changes', () => {
    mockGlobalParams = { focus: '1' };
    const { rerender } = render(<SearchField theme={Colors.light} />);
    mockGlobalParams = { focus: '2' };
    rerender(<SearchField theme={Colors.light} />);
    expect(mockFocus).toHaveBeenCalledTimes(2);
  });

  it('does not focus without a focus param', () => {
    mockGlobalParams = {};
    render(<SearchField theme={Colors.light} />);
    expect(mockFocus).not.toHaveBeenCalled();
  });
});
