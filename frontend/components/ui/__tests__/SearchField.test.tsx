/**
 * SearchField focus signal.
 *
 * The mobile Log tab navigates to the search route with a `focus` param; the top-nav
 * search input (which lives outside that screen) must take focus when it appears or changes.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

const mockFocus = jest.fn();
let mockSearchBarProps: Record<string, any> = {};
let mockGlobalParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  usePathname: () => '/search',
  useGlobalSearchParams: () => mockGlobalParams,
}));

jest.mock('@rneui/themed', () => {
  const React = require('react');
  return {
    SearchBar: React.forwardRef(function MockSearchBar(props: Record<string, any>, ref: React.Ref<unknown>) {
      mockSearchBarProps = props;
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

describe('SearchField placeholder follows the search mode', () => {
  it.each([
    [{}, 'Search a video essay…'],
    [{ type: 'essays' }, 'Search a video essay…'],
    [{ type: 'people' }, 'Search people…'],
    [{ type: 'lists' }, 'Search lists…'],
    [{ type: 'nonsense' }, 'Search a video essay…'],
    [{ mode: 'log', type: 'people' }, 'Search a video essay…'],
  ])('with params %j shows %j', (params, placeholder) => {
    mockGlobalParams = params;
    render(<SearchField theme={Colors.light} />);
    expect(mockSearchBarProps.placeholder).toBe(placeholder);
  });

  it('typing updates only q on the search screen, so the mode is kept', () => {
    const { router } = require('expo-router');
    mockGlobalParams = { type: 'people' };
    render(<SearchField theme={Colors.light} />);

    mockSearchBarProps.onChangeText('film');

    expect(router.setParams).toHaveBeenLastCalledWith({ q: 'film' });
  });
});
