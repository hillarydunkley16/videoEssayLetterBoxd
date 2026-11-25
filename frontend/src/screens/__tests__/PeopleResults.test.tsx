/**
 * People view of the search screen.
 *
 * Empty (or 1-character) input shows suggested people; 2+ characters run a debounced search
 * with infinite scroll. Rows follow/unfollow inline with a busy guard. A slow answer to an
 * earlier query never overwrites a newer one. Clerk, the network and navigation are stubbed.
 */
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

const mockSearchUsers = jest.fn();
const mockFetchSuggestedUsers = jest.fn();
const mockFollowUser = jest.fn();
jest.mock('@/src/api/users', () => ({
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
  fetchSuggestedUsers: (...args: unknown[]) => mockFetchSuggestedUsers(...args),
  followUser: (...args: unknown[]) => mockFollowUser(...args),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));

import PeopleResults from '../PeopleResults';

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

function row(id: number, username: string, is_following = false) {
  return { id, username, imageUrl: null, is_following };
}

function page(results: ReturnType<typeof row>[], next: string | null = null) {
  return { count: results.length, next, previous: null, results };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchSuggestedUsers.mockResolvedValue([]);
  mockSearchUsers.mockResolvedValue(page([]));
});

describe('PeopleResults suggestions', () => {
  it('shows suggested people, and does not search, for an empty query', async () => {
    mockFetchSuggestedUsers.mockResolvedValue([row(2, 'ann'), row(3, 'ben')]);
    render(<PeopleResults q="" />);

    expect(await screen.findByText('ann')).toBeTruthy();
    expect(screen.getByText('ben')).toBeTruthy();
    expect(screen.getByText('Suggested')).toBeTruthy();
    expect(mockFetchSuggestedUsers).toHaveBeenCalledWith('token');
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it.each(['f', ' f ', '   '])('treats %j as too short to search and shows suggestions', async (q) => {
    mockFetchSuggestedUsers.mockResolvedValue([row(2, 'ann')]);
    render(<PeopleResults q={q} />);

    expect(await screen.findByText('ann')).toBeTruthy();
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('says so when there are no suggestions', async () => {
    render(<PeopleResults q="" />);
    expect(await screen.findByText(/No suggestions yet/)).toBeTruthy();
  });

  it('does not label search results as suggestions', async () => {
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan')]));
    render(<PeopleResults q="film" />);

    expect(await screen.findByText('filmfan')).toBeTruthy();
    expect(screen.queryByText('Suggested')).toBeNull();
    expect(mockFetchSuggestedUsers).not.toHaveBeenCalled();
  });
});

describe('PeopleResults search', () => {
  it('searches with the trimmed query and the token, and renders a row per person', async () => {
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan'), row(3, 'filmbuff')]));
    render(<PeopleResults q="  film  " />);

    expect(await screen.findByText('filmfan')).toBeTruthy();
    expect(screen.getByText('filmbuff')).toBeTruthy();
    expect(mockSearchUsers).toHaveBeenCalledWith('film', 1, 'token');
  });

  it('sends one request for a burst of keystrokes', async () => {
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan')]));
    const { rerender } = render(<PeopleResults q="fi" />);
    rerender(<PeopleResults q="fil" />);
    rerender(<PeopleResults q="film" />);

    expect(await screen.findByText('filmfan')).toBeTruthy();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(mockSearchUsers).toHaveBeenCalledTimes(1);
    expect(mockSearchUsers).toHaveBeenCalledWith('film', 1, 'token');
  });

  it('drops a slow answer to an earlier query', async () => {
    let resolveAnn: (value: unknown) => void = () => {};
    mockSearchUsers.mockImplementation((q: string) =>
      q === 'ann' ? new Promise((resolve) => { resolveAnn = resolve; }) : Promise.resolve(page([row(3, 'benji')])),
    );
    const { rerender } = render(<PeopleResults q="ann" />);
    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledWith('ann', 1, 'token'));

    rerender(<PeopleResults q="ben" />);
    expect(await screen.findByText('benji')).toBeTruthy();
    await act(async () => {
      resolveAnn(page([row(2, 'annie')]));
    });

    expect(screen.queryByText('annie')).toBeNull();
    expect(screen.getByText('benji')).toBeTruthy();
  });

  it('requests the next page when the end of the list is reached', async () => {
    mockSearchUsers
      .mockResolvedValueOnce(page([row(2, 'filmfan')], 'http://x/?page=2'))
      .mockResolvedValueOnce(page([row(3, 'filmbuff')]));
    render(<PeopleResults q="film" />);
    await screen.findByText('filmfan');

    fireEvent(screen.getByTestId('people-list'), 'endReached');

    expect(await screen.findByText('filmbuff')).toBeTruthy();
    expect(mockSearchUsers).toHaveBeenLastCalledWith('film', 2, 'token');
    expect(screen.getByText('filmfan')).toBeTruthy();
  });

  it('does not request another page when there is no next page', async () => {
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan')]));
    render(<PeopleResults q="film" />);
    await screen.findByText('filmfan');

    fireEvent(screen.getByTestId('people-list'), 'endReached');

    expect(mockSearchUsers).toHaveBeenCalledTimes(1);
  });

  it('starts again from page 1 when the query changes', async () => {
    mockSearchUsers
      .mockResolvedValueOnce(page([row(2, 'filmfan')], 'http://x/?page=2'))
      .mockResolvedValueOnce(page([row(3, 'cinephile')]));
    const { rerender } = render(<PeopleResults q="film" />);
    await screen.findByText('filmfan');

    rerender(<PeopleResults q="cine" />);

    expect(await screen.findByText('cinephile')).toBeTruthy();
    expect(screen.queryByText('filmfan')).toBeNull();
    expect(mockSearchUsers).toHaveBeenLastCalledWith('cine', 1, 'token');
  });

  it('shows an empty state naming the query', async () => {
    render(<PeopleResults q="zzz" />);
    expect(await screen.findByText(/No one found for/)).toBeTruthy();
    expect(screen.getByText(/zzz/)).toBeTruthy();
  });

  it('shows an error with a retry, and recovers on retry', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSearchUsers.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page([row(2, 'filmfan')]));
    render(<PeopleResults q="film" />);

    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('people-retry'));

    expect(await screen.findByText('filmfan')).toBeTruthy();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it('shows the same error when suggestions fail to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchSuggestedUsers.mockRejectedValue(new Error('boom'));
    render(<PeopleResults q="" />);
    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
  });
});

describe('PeopleResults rows', () => {
  it('opens the person’s profile when their row is pressed', async () => {
    mockSearchUsers.mockResolvedValue(page([row(7, 'filmfan')]));
    render(<PeopleResults q="film" />);

    fireEvent.press(await screen.findByText('filmfan'));

    expect(mockPush).toHaveBeenCalledWith('/otherProfile/7');
  });

  it('follows from a row and flips only that row', async () => {
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan'), row(3, 'filmbuff')]));
    mockFollowUser.mockResolvedValue({ following: true, followers_count: 1 });
    render(<PeopleResults q="film" />);
    await screen.findByText('filmfan');

    fireEvent.press(screen.getByTestId('follow-toggle-2'));

    await waitFor(() => expect(screen.getAllByText('Following')).toHaveLength(1));
    expect(screen.getAllByText('Follow')).toHaveLength(1);
    expect(mockFollowUser).toHaveBeenCalledWith(2, expect.any(Function));
  });

  it('unfollows a followed person', async () => {
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan', true)]));
    mockFollowUser.mockResolvedValue({ following: false, followers_count: 0 });
    render(<PeopleResults q="film" />);
    await screen.findByText('Following');

    fireEvent.press(screen.getByTestId('follow-toggle-2'));

    expect(await screen.findByText('Follow')).toBeTruthy();
  });

  it('follows only once when the button is double-tapped', async () => {
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan')]));
    let resolveFollow: (value: unknown) => void = () => {};
    mockFollowUser.mockImplementation(() => new Promise((resolve) => { resolveFollow = resolve; }));
    render(<PeopleResults q="film" />);
    await screen.findByText('filmfan');

    fireEvent.press(screen.getByTestId('follow-toggle-2'));
    fireEvent.press(screen.getByTestId('follow-toggle-2'));
    await act(async () => {
      resolveFollow({ following: true, followers_count: 1 });
    });

    expect(mockFollowUser).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Following')).toBeTruthy();
  });

  it('leaves the row unchanged when following fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSearchUsers.mockResolvedValue(page([row(2, 'filmfan')]));
    mockFollowUser.mockRejectedValue(new Error('boom'));
    render(<PeopleResults q="film" />);
    await screen.findByText('filmfan');

    fireEvent.press(screen.getByTestId('follow-toggle-2'));

    await waitFor(() => expect(mockFollowUser).toHaveBeenCalled());
    expect(screen.getByText('Follow')).toBeTruthy();
  });
});
