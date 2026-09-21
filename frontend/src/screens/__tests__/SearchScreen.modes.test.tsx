/**
 * Search screen modes (Essays | People), driven by the `type` route param.
 *
 * Essays stays the default and is untouched (SearchScreen.logMode.test.tsx still covers its
 * behavior); People swaps the results; the switch writes only `type`, so `q` is kept. Log mode
 * (mobile Log tab) hides the switch and stays on essays. Clerk, the network and navigation are stubbed.
 */
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    setParams: (...args: unknown[]) => mockSetParams(...args),
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

const mockSearchDataBase = jest.fn();
const mockCallSerpAPI = jest.fn();
jest.mock('@/src/api/videos', () => ({
  searchDataBase: (...args: unknown[]) => mockSearchDataBase(...args),
  callSerpAPI: (...args: unknown[]) => mockCallSerpAPI(...args),
  useVideoApi: () => ({ convertYouTubeResultToVideoEssay: jest.fn() }),
}));

const mockSearchUsers = jest.fn();
const mockFetchSuggestedUsers = jest.fn();
jest.mock('@/src/api/users', () => ({
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
  fetchSuggestedUsers: (...args: unknown[]) => mockFetchSuggestedUsers(...args),
  followUser: jest.fn(),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));

import SearchScreen from '../SearchScreen';

jest.setTimeout(20000);

const person = (id: number, username: string) => ({ id, username, imageUrl: null, is_following: false });
const peoplePage = (...people: ReturnType<typeof person>[]) => ({ count: people.length, next: null, previous: null, results: people });

const ESSAY_HINT = /Search for video essays by title/;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockSearchDataBase.mockReset().mockResolvedValue([]);
  mockCallSerpAPI.mockReset().mockResolvedValue([]);
  mockSearchUsers.mockReset().mockResolvedValue(peoplePage());
  mockFetchSuggestedUsers.mockReset().mockResolvedValue([person(9, 'suggested_sam')]);
});

describe('SearchScreen modes', () => {
  it('defaults to the essays view and shows the mode switch', () => {
    render(<SearchScreen />);

    expect(screen.getByText(ESSAY_HINT)).toBeTruthy();
    expect(screen.getByTestId('search-mode-essays')).toBeTruthy();
    expect(screen.getByTestId('search-mode-people')).toBeTruthy();
    expect(screen.getByTestId('search-mode-essays').props.accessibilityState).toMatchObject({ selected: true });
    expect(mockFetchSuggestedUsers).not.toHaveBeenCalled();
  });

  it('shows the people view for type=people, and does not run the essay search', async () => {
    mockParams = { type: 'people' };
    render(<SearchScreen />);

    expect(await screen.findByText('suggested_sam')).toBeTruthy();
    expect(screen.queryByText(ESSAY_HINT)).toBeNull();
    expect(screen.getByTestId('search-mode-people').props.accessibilityState).toMatchObject({ selected: true });
    expect(mockSearchDataBase).not.toHaveBeenCalled();
  });

  it.each(['lists', 'nonsense', ''])('falls back to essays for type=%j', (type) => {
    mockParams = { type };
    render(<SearchScreen />);
    expect(screen.getByText(ESSAY_HINT)).toBeTruthy();
    expect(mockFetchSuggestedUsers).not.toHaveBeenCalled();
  });

  it('searches people with the q param', async () => {
    mockParams = { type: 'people', q: 'film' };
    mockSearchUsers.mockResolvedValue(peoplePage(person(2, 'filmfan')));
    render(<SearchScreen />);

    expect(await screen.findByText('filmfan')).toBeTruthy();
    expect(mockSearchUsers).toHaveBeenCalledWith('film', 1, 'token');
  });

  it('never calls the YouTube search from the people view, even on submit', async () => {
    mockParams = { type: 'people', q: 'film', submittedAt: '1' };
    render(<SearchScreen />);
    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalled());
    expect(mockCallSerpAPI).not.toHaveBeenCalled();
  });

  it('writes only `type` when a mode is chosen, so the query is kept', () => {
    mockParams = { q: 'film' };
    render(<SearchScreen />);

    fireEvent.press(screen.getByTestId('search-mode-people'));
    expect(mockSetParams).toHaveBeenLastCalledWith({ type: 'people' });

    fireEvent.press(screen.getByTestId('search-mode-essays'));
    expect(mockSetParams).toHaveBeenLastCalledWith({ type: 'essays' });
  });

  it('keeps q when the mode changes', async () => {
    mockParams = { q: 'essay' };
    const { rerender } = render(<SearchScreen />);
    await waitFor(() => expect(mockSearchDataBase).toHaveBeenCalledWith('essay', 'token'));

    mockParams = { q: 'essay', type: 'people' };
    rerender(<SearchScreen />);
    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledWith('essay', 1, 'token'));

    mockParams = { q: 'essay', type: 'essays' };
    rerender(<SearchScreen />);
    await waitFor(() => expect(mockSearchDataBase.mock.calls.length).toBeGreaterThan(1));
    expect(mockSearchDataBase).toHaveBeenLastCalledWith('essay', 'token');
  });

  it('drops a people answer that arrives after the mode changed', async () => {
    let resolveAnn: (value: unknown) => void = () => {};
    mockSearchUsers.mockImplementation((q: string) =>
      q === 'ann' ? new Promise((resolve) => { resolveAnn = resolve; }) : Promise.resolve(peoplePage(person(3, 'benji'))),
    );
    mockParams = { type: 'people', q: 'ann' };
    const { rerender } = render(<SearchScreen />);
    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledWith('ann', 1, 'token'));

    mockParams = { type: 'essays', q: '' };
    rerender(<SearchScreen />);
    mockParams = { type: 'people', q: 'ben' };
    rerender(<SearchScreen />);
    expect(await screen.findByText('benji')).toBeTruthy();
    await act(async () => {
      resolveAnn(peoplePage(person(2, 'annie')));
    });

    expect(screen.queryByText('annie')).toBeNull();
    expect(screen.getByText('benji')).toBeTruthy();
  });

  it('hides the switch and stays on essays in log mode, whatever `type` says', () => {
    mockParams = { mode: 'log', type: 'people' };
    render(<SearchScreen />);

    expect(screen.queryByTestId('search-mode-people')).toBeNull();
    expect(screen.queryByTestId('search-mode-essays')).toBeNull();
    expect(screen.getByText('Search for the essay you want to log')).toBeTruthy();
    expect(mockFetchSuggestedUsers).not.toHaveBeenCalled();
  });
});
