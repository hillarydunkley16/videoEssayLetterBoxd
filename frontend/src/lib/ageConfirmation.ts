import AsyncStorage from '@react-native-async-storage/async-storage';

// The "I confirm I am 16 or older" tick, made before the visitor has an account. It is persisted
// (not kept in memory) because the Google sign-in redirect reloads the web page, and it is held
// only until sign-in, when useAgeConfirmationSync reports it to the server. Storage can be missing
// or throw, so every access is guarded: the worst case is that the tick is not reported.
export const AGE_CONFIRMATION_KEY = 'watchd:age-confirmed';
export const AGE_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

export type AgeConfirmation = { confirmedAt: number };

export async function saveAgeConfirmation(): Promise<void> {
  try {
    await AsyncStorage.setItem(AGE_CONFIRMATION_KEY, JSON.stringify({ confirmedAt: Date.now() }));
  } catch {
    // Storage blocked: the tick just won't survive a reload.
  }
}

export async function readAgeConfirmation(): Promise<AgeConfirmation | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(AGE_CONFIRMATION_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let value: AgeConfirmation | null = null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.confirmedAt === 'number') value = { confirmedAt: parsed.confirmedAt };
  } catch {
    // Fall through to null.
  }
  if (!value || Date.now() - value.confirmedAt > AGE_CONFIRMATION_TTL_MS) {
    await clearAgeConfirmation();
    return null;
  }
  return value;
}

export async function clearAgeConfirmation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AGE_CONFIRMATION_KEY);
  } catch {
    // Nothing to do: an unreadable entry is ignored on the next read.
  }
}
