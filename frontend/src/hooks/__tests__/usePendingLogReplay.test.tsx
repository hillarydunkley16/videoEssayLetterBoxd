/**
 * A signed-out visitor rates an essay on the landing page; that log is held (pendingLog) and must
 * be saved exactly once after they sign in. Signing in remounts the subtree that owns hooks like
 * this one and fires several auth signals at once, so a double replay is the main risk.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import { readPendingLog, savePendingLog } from '@/src/lib/pendingLog';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGetToken = jest.fn();
let mockIsSignedIn = true;
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ isSignedIn: mockIsSignedIn, getToken: mockGetToken }),
}));

const mockGetOrCreate = jest.fn();
jest.mock('@/src/api/videos', () => ({
  getOrCreateVideoEssayByYoutubeId: (...a: unknown[]) => mockGetOrCreate(...a),
}));

const mockCreateLog = jest.fn();
jest.mock('@/src/api/logs', () => ({ createLog: (...a: unknown[]) => mockCreateLog(...a) }));

const mockAuthPost = jest.fn();
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => mockAuthPost }));

const mockShowToast = jest.fn();
jest.mock('@/src/helpers/toast', () => ({ showToast: (...a: unknown[]) => mockShowToast(...a) }));

import { usePendingLogReplay, __resetPendingLogReplayForTests } from '../usePendingLogReplay';

const pending = { youtubeId: 'dQw4w9WgXcQ', rating: 4, reviewText: 'Sharp and funny' };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  __resetPendingLogReplayForTests();
  mockIsSignedIn = true;
  mockGetToken.mockResolvedValue('tok');
  mockGetOrCreate.mockResolvedValue({ public_id: 'essay-uuid' });
  mockCreateLog.mockResolvedValue({ id: 1 });
});

it('does nothing when signed out, and keeps the pending log', async () => {
  mockIsSignedIn = false;
  await savePendingLog(pending);
  renderHook(() => usePendingLogReplay());
  await new Promise((r) => setTimeout(r, 20));
  expect(mockGetOrCreate).not.toHaveBeenCalled();
  expect(await readPendingLog()).not.toBeNull();
});

it('does nothing when signed in with no pending log', async () => {
  renderHook(() => usePendingLogReplay());
  await new Promise((r) => setTimeout(r, 20));
  expect(mockGetOrCreate).not.toHaveBeenCalled();
  expect(mockCreateLog).not.toHaveBeenCalled();
});

it('resolves the essay, creates the log, clears the pending log and says so', async () => {
  await savePendingLog(pending);
  renderHook(() => usePendingLogReplay());

  await waitFor(() => expect(mockCreateLog).toHaveBeenCalledTimes(1));
  expect(mockGetOrCreate).toHaveBeenCalledWith('dQw4w9WgXcQ', 'tok');
  expect(mockCreateLog).toHaveBeenCalledWith(mockAuthPost, {
    essay: 'essay-uuid',
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    rating: 4,
    review_text: 'Sharp and funny',
  });
  await waitFor(async () => expect(await readPendingLog()).toBeNull());
  expect(mockShowToast).toHaveBeenCalledWith('Log saved');
});

// The backend's Log.review_text is a required CharField (no blank=True), so a log with no review
// is rejected with 400 "This field is required" if the field is missing, or "may not be blank" if
// empty. quickLog works around that with a placeholder for rating-only logs; replay does the same.
it('sends the quick-log placeholder as review_text when the visitor wrote no review', async () => {
  await savePendingLog({ ...pending, reviewText: '' });
  renderHook(() => usePendingLogReplay());
  await waitFor(() => expect(mockCreateLog).toHaveBeenCalled());
  expect(mockCreateLog.mock.calls[0][1]).toMatchObject({ review_text: 'Blank review text for quick log' });
});

it('creates exactly one log when two auth signals fire at once (Prove-It)', async () => {
  await savePendingLog(pending);
  // Two mounted copies stand in for Clerk remounting the layout while isSignedIn flips true.
  renderHook(() => usePendingLogReplay());
  renderHook(() => usePendingLogReplay());

  await waitFor(() => expect(mockCreateLog).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 30));
  expect(mockGetOrCreate).toHaveBeenCalledTimes(1);
  expect(mockCreateLog).toHaveBeenCalledTimes(1);
});

it('does not log again on a re-render after success', async () => {
  await savePendingLog(pending);
  const { rerender } = renderHook(() => usePendingLogReplay());
  await waitFor(() => expect(mockCreateLog).toHaveBeenCalledTimes(1));
  await waitFor(async () => expect(await readPendingLog()).toBeNull());

  rerender({});
  await new Promise((r) => setTimeout(r, 20));
  expect(mockCreateLog).toHaveBeenCalledTimes(1);
});

it('keeps the pending log and explains when the essay cannot be resolved', async () => {
  await savePendingLog(pending);
  mockGetOrCreate.mockRejectedValue(new Error('422'));
  renderHook(() => usePendingLogReplay());

  await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
  expect(mockCreateLog).not.toHaveBeenCalled();
  expect(await readPendingLog()).not.toBeNull();
  expect(mockShowToast.mock.calls[0][0]).toMatch(/couldn't save/i);
});

it('keeps the pending log when creating the log fails', async () => {
  await savePendingLog(pending);
  mockCreateLog.mockRejectedValue(new Error('500'));
  renderHook(() => usePendingLogReplay());

  await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
  expect(await readPendingLog()).not.toBeNull();
});

it('does not retry in a loop after a failure, even if the layout remounts', async () => {
  await savePendingLog(pending);
  mockGetOrCreate.mockRejectedValue(new Error('network'));
  const first = renderHook(() => usePendingLogReplay());
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledTimes(1));

  first.unmount();
  renderHook(() => usePendingLogReplay());
  await new Promise((r) => setTimeout(r, 30));
  expect(mockGetOrCreate).toHaveBeenCalledTimes(1);
  expect(mockShowToast).toHaveBeenCalledTimes(1);
});
