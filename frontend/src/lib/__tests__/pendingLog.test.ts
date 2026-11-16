/**
 * The pending log is what a signed-out visitor rated on the landing page, kept until they have an
 * account. Storage can be blocked or hold junk, and an old entry must not be replayed later.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MAX_REVIEW_LENGTH } from '../reviewLimit';
import {
  PENDING_LOG_KEY,
  PENDING_LOG_TTL_MS,
  clearPendingLog,
  readPendingLog,
  savePendingLog,
} from '../pendingLog';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('pendingLog', () => {
  it('round-trips a saved log', async () => {
    await savePendingLog({ youtubeId: 'dQw4w9WgXcQ', rating: 4, reviewText: 'Great' });
    await expect(readPendingLog()).resolves.toMatchObject({
      youtubeId: 'dQw4w9WgXcQ',
      rating: 4,
      reviewText: 'Great',
    });
  });

  it('returns null when nothing is saved', async () => {
    await expect(readPendingLog()).resolves.toBeNull();
  });

  it('clears the entry', async () => {
    await savePendingLog({ youtubeId: 'abc', rating: 3, reviewText: '' });
    await clearPendingLog();
    await expect(readPendingLog()).resolves.toBeNull();
  });

  it('ignores and clears an entry older than 24 hours', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await savePendingLog({ youtubeId: 'abc', rating: 3, reviewText: '' });

    jest.spyOn(Date, 'now').mockReturnValue(now + PENDING_LOG_TTL_MS + 1);
    await expect(readPendingLog()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(PENDING_LOG_KEY)).resolves.toBeNull();
  });

  it('still returns an entry just inside the 24 hour window', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await savePendingLog({ youtubeId: 'abc', rating: 3, reviewText: '' });

    jest.spyOn(Date, 'now').mockReturnValue(now + PENDING_LOG_TTL_MS);
    await expect(readPendingLog()).resolves.not.toBeNull();
  });

  it.each([
    ['not json', '}{'],
    ['wrong shape', JSON.stringify({ hello: 'world' })],
    ['rating out of range', JSON.stringify({ youtubeId: 'abc', rating: 9, reviewText: '', savedAt: Date.now() })],
    ['empty youtube id', JSON.stringify({ youtubeId: '', rating: 3, reviewText: '', savedAt: Date.now() })],
  ])('returns null and clears an entry that is %s', async (_label, raw) => {
    await AsyncStorage.setItem(PENDING_LOG_KEY, raw);
    await expect(readPendingLog()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(PENDING_LOG_KEY)).resolves.toBeNull();
  });

  it('clamps the rating to 1-5 and caps the review at the backend limit of 200 when saving', async () => {
    await savePendingLog({ youtubeId: 'abc', rating: 12, reviewText: 'x'.repeat(MAX_REVIEW_LENGTH + 50) });
    const log = await readPendingLog();
    expect(log?.rating).toBe(5);
    expect(MAX_REVIEW_LENGTH).toBe(200);
    expect(log?.reviewText).toHaveLength(MAX_REVIEW_LENGTH);
  });

  it('stores only the log fields, nothing about the user', async () => {
    await savePendingLog({ youtubeId: 'abc', rating: 3, reviewText: 'ok' });
    const stored = JSON.parse((await AsyncStorage.getItem(PENDING_LOG_KEY)) as string);
    expect(Object.keys(stored).sort()).toEqual(['rating', 'reviewText', 'savedAt', 'youtubeId']);
  });

  it('never throws when storage is blocked', async () => {
    const blocked = new Error('storage blocked');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(blocked);
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(blocked);
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(blocked);

    await expect(savePendingLog({ youtubeId: 'abc', rating: 3, reviewText: '' })).resolves.toBeUndefined();
    await expect(readPendingLog()).resolves.toBeNull();
    await expect(clearPendingLog()).resolves.toBeUndefined();
  });
});
