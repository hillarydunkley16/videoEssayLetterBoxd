/**
 * Lists view of the search screen.
 *
 * Under two characters it shows a prompt; from two on it runs a debounced list-name search
 * with infinite scroll, rendering the shared list card (with the owner's name). A slow answer
 * to an earlier query never overwrites a newer one. Clerk, the network and navigation are stubbed.
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

const mockSearchCollections = jest.fn();
jest.mock('@/src/api/collection', () => ({
  searchCollections: (...args: unknown[]) => mockSearchCollections(...args),
}));

import ListResults from '../ListResults';

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

function list(id: string, name: string, owner = 'friend_handle') {
  return { id: 1, public_id: id, name, description: '', owner, is_owner: false, essays: [], is_watchlist: false };
}

function page(results: ReturnType<typeof list>[], next: string | null = null) {
  return { count: results.length, next, previous: null, results };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchCollections.mockResolvedValue(page([]));
});

describe('ListResults', () => {
  it.each(['', ' ', 'f', ' f '])('shows a prompt and does not search for %j', (q) => {
    render(<ListResults q={q} />);
    expect(screen.getByText('Search lists by name')).toBeTruthy();
    expect(mockSearchCollections).not.toHaveBeenCalled();
  });

  it('searches with the trimmed query and the token, and renders a card per list with its owner', async () => {
    mockSearchCollections.mockResolvedValue(page([list('a', 'Film picks', 'ann'), list('b', 'Film school', 'ben')]));
    render(<ListResults q="  film  " />);

    expect(await screen.findByText('Film picks')).toBeTruthy();
    expect(screen.getByText('Film school')).toBeTruthy();
    expect(screen.getByText('by ann')).toBeTruthy();
    expect(screen.getByText('by ben')).toBeTruthy();
    expect(mockSearchCollections).toHaveBeenCalledWith('film', 1, 'token');
  });

  it('opens the list when its card is pressed', async () => {
    mockSearchCollections.mockResolvedValue(page([list('abc-123', 'Film picks')]));
    render(<ListResults q="film" />);

    fireEvent.press(await screen.findByText('Film picks'));

    expect(mockPush).toHaveBeenCalledWith('/collectionDetail?publicId=abc-123');
  });

  it('sends one request for a burst of keystrokes', async () => {
    mockSearchCollections.mockResolvedValue(page([list('a', 'Film picks')]));
    const { rerender } = render(<ListResults q="fi" />);
    rerender(<ListResults q="fil" />);
    rerender(<ListResults q="film" />);

    expect(await screen.findByText('Film picks')).toBeTruthy();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(mockSearchCollections).toHaveBeenCalledTimes(1);
    expect(mockSearchCollections).toHaveBeenCalledWith('film', 1, 'token');
  });

  it('drops a slow answer to an earlier query', async () => {
    let resolveAnn: (value: unknown) => void = () => {};
    mockSearchCollections.mockImplementation((q: string) =>
      q === 'ann' ? new Promise((resolve) => { resolveAnn = resolve; }) : Promise.resolve(page([list('b', 'Bens list')])),
    );
    const { rerender } = render(<ListResults q="ann" />);
    await waitFor(() => expect(mockSearchCollections).toHaveBeenCalledWith('ann', 1, 'token'));

    rerender(<ListResults q="ben" />);
    expect(await screen.findByText('Bens list')).toBeTruthy();
    await act(async () => {
      resolveAnn(page([list('a', 'Anns list')]));
    });

    expect(screen.queryByText('Anns list')).toBeNull();
    expect(screen.getByText('Bens list')).toBeTruthy();
  });

  it('requests the next page when the end of the list is reached', async () => {
    mockSearchCollections
      .mockResolvedValueOnce(page([list('a', 'Film picks')], 'http://x/?page=2'))
      .mockResolvedValueOnce(page([list('b', 'Film school')]));
    render(<ListResults q="film" />);
    await screen.findByText('Film picks');

    fireEvent(screen.getByTestId('lists-list'), 'endReached');

    expect(await screen.findByText('Film school')).toBeTruthy();
    expect(mockSearchCollections).toHaveBeenLastCalledWith('film', 2, 'token');
    expect(screen.getByText('Film picks')).toBeTruthy();
  });

  it('does not request another page when there is no next page', async () => {
    mockSearchCollections.mockResolvedValue(page([list('a', 'Film picks')]));
    render(<ListResults q="film" />);
    await screen.findByText('Film picks');

    fireEvent(screen.getByTestId('lists-list'), 'endReached');

    expect(mockSearchCollections).toHaveBeenCalledTimes(1);
  });

  it('starts again from page 1 when the query changes', async () => {
    mockSearchCollections
      .mockResolvedValueOnce(page([list('a', 'Film picks')], 'http://x/?page=2'))
      .mockResolvedValueOnce(page([list('b', 'Cinema club')]));
    const { rerender } = render(<ListResults q="film" />);
    await screen.findByText('Film picks');

    rerender(<ListResults q="cine" />);

    expect(await screen.findByText('Cinema club')).toBeTruthy();
    expect(screen.queryByText('Film picks')).toBeNull();
    expect(mockSearchCollections).toHaveBeenLastCalledWith('cine', 1, 'token');
  });

  it('shows an empty state naming the query', async () => {
    render(<ListResults q="zzz" />);
    expect(await screen.findByText(/No lists match/)).toBeTruthy();
    expect(screen.getByText(/zzz/)).toBeTruthy();
  });

  it('shows an error with a retry, and recovers on retry', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSearchCollections.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page([list('a', 'Film picks')]));
    render(<ListResults q="film" />);

    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('lists-retry'));

    expect(await screen.findByText('Film picks')).toBeTruthy();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });
});
