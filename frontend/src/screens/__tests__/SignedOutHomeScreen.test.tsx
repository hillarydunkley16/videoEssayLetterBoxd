/**
 * The signed-out landing page: search is the hero. A visitor searches, taps an essay, rates it,
 * and only then is asked to make an account. The rated log is kept (pendingLog) so it can be
 * saved after sign-up.
 */
import { StyleSheet } from 'react-native';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignedOutHomeScreen from '../SignedOutHomeScreen';

const mockPopular = jest.fn();
const mockSearch = jest.fn();
const mockSearchDb = jest.fn();
jest.mock('@/src/api/videos', () => ({
  fetchPopularVideoEssaysPublic: (...a: unknown[]) => mockPopular(...a),
  searchYoutube: (...a: unknown[]) => mockSearch(...a),
  searchDataBasePublic: (...a: unknown[]) => mockSearchDb(...a),
}));

const mockSavePending = jest.fn().mockResolvedValue(undefined);
const mockClearPending = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/lib/pendingLog', () => ({
  savePendingLog: (...a: unknown[]) => mockSavePending(...a),
  clearPendingLog: (...a: unknown[]) => mockClearPending(...a),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/src/components/GoogleButton', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>GOOGLE</Text> };
});

const popularEssay = {
  id: 1,
  public_id: 'pub-1',
  youtube_url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
  title: 'Line Goes Up',
  thumbnail: 'https://img.test/a.jpg',
  duration: '2:17:28',
  views: 10,
  channel_name: 'Folding Ideas',
  channel_url: 'https://yt.test/c',
};

const apiRow = (id: string, title: string) => ({
  source: 'api' as const,
  video: {
    youtube_url: `https://www.youtube.com/watch?v=${id}`,
    title,
    thumbnail: 'https://img.test/t.jpg',
    channel_name: 'Every Frame a Painting',
    views: 5,
    channel_url: 'https://yt.test/c2',
  },
});

const SEARCH_BOX = 'Search video essays';

async function typeAndWait(text: string) {
  fireEvent.changeText(screen.getByLabelText(SEARCH_BOX), text);
  await act(async () => {
    jest.advanceTimersByTime(450);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPopular.mockResolvedValue({ count: 1, next: null, previous: null, results: [popularEssay] });
  mockSearch.mockResolvedValue({ results: [apiRow('bbbbbbbbbbb', 'How to Do Visual Comedy')], status: 'ok' });
  mockSearchDb.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

describe('SignedOutHomeScreen', () => {
  it('puts search first and shows popular essays below it', async () => {
    render(<SignedOutHomeScreen />);
    expect(screen.getByLabelText(SEARCH_BOX)).toBeTruthy();
    expect(await screen.findByText('Line Goes Up')).toBeTruthy();
    expect(screen.getByText('Popular this week')).toBeTruthy();
    expect(screen.queryByText('Create account')).toBeNull();
  });

  it('hides the popular heading when there are no popular essays', async () => {
    mockPopular.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    render(<SignedOutHomeScreen />);
    await act(async () => {});
    expect(screen.queryByText('Popular this week')).toBeNull();
  });

  it('pins title and channel to the left so right-to-left names do not flip the row', async () => {
    render(<SignedOutHomeScreen />);
    const title = await screen.findByText('Line Goes Up');
    expect(StyleSheet.flatten(title.props.style).textAlign).toBe('left');
  });

  it('shows the runtime stamp on a search result that has a duration', async () => {
    const row = apiRow('bbbbbbbbbbb', 'How to Do Visual Comedy');
    mockSearch.mockResolvedValue({
      results: [{ ...row, video: { ...row.video, duration: '11:13' } }],
      status: 'ok',
    });
    render(<SignedOutHomeScreen />);
    await typeAndWait('visual');
    expect(await screen.findByText('11:13')).toBeTruthy();
  });

  it('makes no request for fewer than 3 characters', async () => {
    render(<SignedOutHomeScreen />);
    await typeAndWait('vi');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('sends one request for the latest text after the visitor pauses typing', async () => {
    render(<SignedOutHomeScreen />);
    fireEvent.changeText(screen.getByLabelText(SEARCH_BOX), 'vis');
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    await typeAndWait('visual');

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch.mock.calls[0][0]).toBe('visual');
    expect(await screen.findByText('How to Do Visual Comedy')).toBeTruthy();
    expect(screen.getByText('Results')).toBeTruthy();
  });

  it('asks the visitor to wait when the search is rate limited', async () => {
    mockSearch.mockResolvedValue({ results: [], status: 'rate_limited' });
    render(<SignedOutHomeScreen />);
    await typeAndWait('visual');
    expect(await screen.findByText('Too many searches. Try again in a minute')).toBeTruthy();
  });

  it('falls back to essays already on watchd when external search is switched off', async () => {
    mockSearch.mockResolvedValue({ results: [], status: 'unavailable' });
    mockSearchDb.mockResolvedValue([{ source: 'database', video: { ...popularEssay, title: 'Stored Essay' } }]);
    render(<SignedOutHomeScreen />);
    await typeAndWait('stored');
    expect(await screen.findByText('Stored Essay')).toBeTruthy();
    expect(mockSearchDb).toHaveBeenCalledWith('stored');
  });

  it('offers a retry when the search fails', async () => {
    mockSearch.mockResolvedValue({ results: [], status: 'error' });
    render(<SignedOutHomeScreen />);
    await typeAndWait('visual');
    expect(await screen.findByText("Search didn't work")).toBeTruthy();
    mockSearch.mockResolvedValue({ results: [apiRow('ccccccccccc', 'Recovered')], status: 'ok' });
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Recovered')).toBeTruthy();
  });

  it('skips a result whose link has no YouTube id', async () => {
    mockSearch.mockResolvedValue({
      results: [apiRow('bbbbbbbbbbb', 'Good Row'), { ...apiRow('x', 'Broken Row'), video: { ...apiRow('x', 'Broken Row').video, youtube_url: 'https://example.com/nope' } }],
      status: 'ok',
    });
    render(<SignedOutHomeScreen />);
    await typeAndWait('rows');
    expect(await screen.findByText('Good Row')).toBeTruthy();
    expect(screen.queryByText('Broken Row')).toBeNull();
  });

  it('opens the rating sheet for a tapped essay and keeps the log once rated', async () => {
    render(<SignedOutHomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Log Line Goes Up' }));

    fireEvent.press(screen.getByLabelText('Rate 4 out of 5'));
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));

    await waitFor(() =>
      expect(mockSavePending).toHaveBeenCalledWith({ youtubeId: 'aaaaaaaaaaa', rating: 4, reviewText: '' }),
    );
    expect(await screen.findByText('Create an account to save it')).toBeTruthy();
  });

  it('discards the log when the visitor cancels the rating', async () => {
    render(<SignedOutHomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Log Line Goes Up' }));
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockClearPending).toHaveBeenCalled();
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(screen.queryByText('Create an account to save it')).toBeNull();
  });

  it('returns to the rating with the earlier answer when the visitor goes Back', async () => {
    render(<SignedOutHomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Log Line Goes Up' }));
    fireEvent.press(screen.getByLabelText('Rate 5 out of 5'));
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Back to rating' }));

    expect(screen.queryByText('Create an account to save it')).toBeNull();
    expect((await screen.findByRole('button', { name: 'Log it' })).props.accessibilityState.disabled).toBe(false);
  });
});
