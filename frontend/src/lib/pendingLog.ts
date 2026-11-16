import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_REVIEW_LENGTH } from './reviewLimit';

// The log a signed-out visitor made on the landing page, held until they have an account.
// It is persisted (not kept in memory) because the Google sign-in redirect reloads the web
// page. It holds only what is needed to create the log later, never anything about the user.
// Storage can be missing or throw (private windows, blocked site data), so every access is
// guarded: the worst case is that the log is not kept across a reload.
export const PENDING_LOG_KEY = 'watchd:pending-log';
export const PENDING_LOG_TTL_MS = 24 * 60 * 60 * 1000;

export type PendingLog = {
  youtubeId: string;
  rating: number;
  reviewText: string;
  savedAt: number;
};

export async function savePendingLog(log: Omit<PendingLog, 'savedAt'>): Promise<void> {
  const entry: PendingLog = {
    youtubeId: log.youtubeId,
    rating: Math.min(5, Math.max(1, Math.round(log.rating))),
    reviewText: log.reviewText.slice(0, MAX_REVIEW_LENGTH),
    savedAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(PENDING_LOG_KEY, JSON.stringify(entry));
  } catch {
    // Storage blocked: the log just won't survive a reload.
  }
}

export async function readPendingLog(): Promise<PendingLog | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(PENDING_LOG_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const log = parse(raw);
  if (!log || Date.now() - log.savedAt > PENDING_LOG_TTL_MS) {
    await clearPendingLog();
    return null;
  }
  return log;
}

export async function clearPendingLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_LOG_KEY);
  } catch {
    // Nothing to do: an unreadable entry is ignored on the next read.
  }
}

function parse(raw: string): PendingLog | null {
  try {
    const value = JSON.parse(raw);
    if (
      typeof value?.youtubeId === 'string' &&
      value.youtubeId !== '' &&
      Number.isInteger(value.rating) &&
      value.rating >= 1 &&
      value.rating <= 5 &&
      typeof value.reviewText === 'string' &&
      typeof value.savedAt === 'number'
    ) {
      return value;
    }
  } catch {
    // Fall through to null.
  }
  return null;
}
