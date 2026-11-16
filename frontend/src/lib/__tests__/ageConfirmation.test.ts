/**
 * The age tick is made before the visitor has an account, so it is held until sign-in and then
 * reported to the server. It must survive the Google redirect (a page reload), expire, and never
 * throw when storage is blocked.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AGE_CONFIRMATION_KEY,
  AGE_CONFIRMATION_TTL_MS,
  clearAgeConfirmation,
  readAgeConfirmation,
  saveAgeConfirmation,
} from '../ageConfirmation';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('ageConfirmation', () => {
  it('is absent until the visitor ticks the box', async () => {
    await expect(readAgeConfirmation()).resolves.toBeNull();
  });

  it('round-trips a saved confirmation', async () => {
    await saveAgeConfirmation();
    await expect(readAgeConfirmation()).resolves.toMatchObject({ confirmedAt: expect.any(Number) });
  });

  it('is cleared on request', async () => {
    await saveAgeConfirmation();
    await clearAgeConfirmation();
    await expect(readAgeConfirmation()).resolves.toBeNull();
  });

  it('is ignored, and removed, once it is older than the time limit', async () => {
    await AsyncStorage.setItem(
      AGE_CONFIRMATION_KEY,
      JSON.stringify({ confirmedAt: Date.now() - AGE_CONFIRMATION_TTL_MS - 1000 }),
    );
    await expect(readAgeConfirmation()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(AGE_CONFIRMATION_KEY)).resolves.toBeNull();
  });

  it('treats malformed storage as absent', async () => {
    await AsyncStorage.setItem(AGE_CONFIRMATION_KEY, '{not json');
    await expect(readAgeConfirmation()).resolves.toBeNull();
    await AsyncStorage.setItem(AGE_CONFIRMATION_KEY, JSON.stringify({ confirmedAt: 'yesterday' }));
    await expect(readAgeConfirmation()).resolves.toBeNull();
  });

  it('never throws when storage is blocked', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('blocked'));
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('blocked'));
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(new Error('blocked'));
    await expect(saveAgeConfirmation()).resolves.toBeUndefined();
    await expect(readAgeConfirmation()).resolves.toBeNull();
    await expect(clearAgeConfirmation()).resolves.toBeUndefined();
  });
});
