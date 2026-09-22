/**
 * Wires a received share intent to the quickLog flow: parses a youtube_id out of the
 * shared text, resolves it to a VideoEssay via the backend, and navigates to quickLog.
 * Signed-out handling is deferred to T6 — for now a signed-out share is just dropped
 * (resetShareIntent, no navigation), per tasks/plan-share-to-app.md's task ordering.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

const mockResetShareIntent = jest.fn();
let mockShareIntentState: { hasShareIntent: boolean; shareIntent: { text?: string; webUrl?: string } } = {
  hasShareIntent: false,
  shareIntent: {},
};
jest.mock('expo-share-intent', () => ({
  useShareIntentContext: () => ({
    hasShareIntent: mockShareIntentState.hasShareIntent,
    shareIntent: mockShareIntentState.shareIntent,
    resetShareIntent: mockResetShareIntent,
  }),
}));

const mockGetToken = jest.fn();
let mockIsSignedIn = true;
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ isSignedIn: mockIsSignedIn, getToken: mockGetToken }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const mockGetOrCreate = jest.fn();
jest.mock('@/src/api/videos', () => ({
  getOrCreateVideoEssayByYoutubeId: (...a: unknown[]) => mockGetOrCreate(...a),
}));

import { useShareIntentRouter } from '../useShareIntentRouter';

beforeEach(() => {
  jest.clearAllMocks();
  mockShareIntentState = { hasShareIntent: false, shareIntent: {} };
  mockIsSignedIn = true;
  mockGetToken.mockResolvedValue('tok');
});

it('does nothing when there is no share intent', () => {
  renderHook(() => useShareIntentRouter());
  expect(mockGetOrCreate).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockResetShareIntent).not.toHaveBeenCalled();
});

it('resets and does not navigate when the shared text has no YouTube URL', async () => {
  mockShareIntentState = { hasShareIntent: true, shareIntent: { text: 'just some text' } };
  renderHook(() => useShareIntentRouter());
  await waitFor(() => expect(mockResetShareIntent).toHaveBeenCalled());
  expect(mockGetOrCreate).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it('resolves the essay and navigates to quickLog when signed in', async () => {
  mockShareIntentState = {
    hasShareIntent: true,
    shareIntent: { webUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  };
  mockGetOrCreate.mockResolvedValue({ public_id: 'abc-123' });
  renderHook(() => useShareIntentRouter());
  await waitFor(() => expect(mockPush).toHaveBeenCalled());
  expect(mockGetOrCreate).toHaveBeenCalledWith('dQw4w9WgXcQ', 'tok');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/quickLog?essayId=abc-123');
  expect(mockResetShareIntent).toHaveBeenCalled();
});

it('resets without navigating when signed out (resume-after-sign-in is T6)', async () => {
  mockIsSignedIn = false;
  mockShareIntentState = {
    hasShareIntent: true,
    shareIntent: { webUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  };
  renderHook(() => useShareIntentRouter());
  await waitFor(() => expect(mockResetShareIntent).toHaveBeenCalled());
  expect(mockGetOrCreate).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});
