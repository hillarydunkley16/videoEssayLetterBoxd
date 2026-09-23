/**
 * Wires a received share intent to the quickLog flow: parses a youtube_id out of the
 * shared text, resolves it to a VideoEssay via the backend, and navigates to quickLog.
 * A signed-out share is held (not dropped) and resumed once isSignedIn flips true —
 * this app's sign-in is native RN screens (Clerk useSignIn/useSignUp), no WebView/
 * system-browser redirect, so in-memory state survives the sign-in flow (T6 spike).
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';

const mockResetShareIntent = jest.fn();
let mockShareIntentState: { hasShareIntent: boolean; shareIntent: { text?: string; webUrl?: string } } = {
  hasShareIntent: false,
  shareIntent: {},
};
// Real expo-share-intent returns a new shareIntent object reference on every call —
// this mock does too, on purpose, so a test can catch a hook that (re-)depends on
// object identity instead of primitives (see the "unrelated re-renders" test below).
jest.mock('expo-share-intent', () => ({
  useShareIntentContext: () => ({
    hasShareIntent: mockShareIntentState.hasShareIntent,
    shareIntent: { ...mockShareIntentState.shareIntent },
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

const mockAlert = jest.fn();
jest.mock('react-native', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));

const mockGetOrCreate = jest.fn();
jest.mock('@/src/api/videos', () => ({
  getOrCreateVideoEssayByYoutubeId: (...a: unknown[]) => mockGetOrCreate(...a),
}));

import { useShareIntentRouter, __resetPendingShareForTests } from '../useShareIntentRouter';

beforeEach(() => {
  jest.clearAllMocks();
  mockShareIntentState = { hasShareIntent: false, shareIntent: {} };
  mockIsSignedIn = true;
  mockGetToken.mockResolvedValue('tok');
  // pendingYoutubeId is module-level by design (see the hook's own comment on why) —
  // reset it between tests so one test's pending share can't leak into the next.
  __resetPendingShareForTests();
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

it('holds the share (no reset, no navigate) when signed out, waiting to resume', async () => {
  mockIsSignedIn = false;
  mockShareIntentState = {
    hasShareIntent: true,
    shareIntent: { webUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  };
  renderHook(() => useShareIntentRouter());
  await act(async () => {});
  expect(mockGetOrCreate).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockResetShareIntent).not.toHaveBeenCalled();
});

it('resumes a held signed-out share once isSignedIn flips true', async () => {
  mockIsSignedIn = false;
  mockShareIntentState = {
    hasShareIntent: true,
    shareIntent: { webUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  };
  mockGetOrCreate.mockResolvedValue({ public_id: 'abc-123' });
  const { rerender } = renderHook(() => useShareIntentRouter());
  await act(async () => {});
  expect(mockPush).not.toHaveBeenCalled();

  mockIsSignedIn = true;
  rerender(undefined);
  await waitFor(() => expect(mockPush).toHaveBeenCalled());
  expect(mockGetOrCreate).toHaveBeenCalledWith('dQw4w9WgXcQ', 'tok');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/quickLog?essayId=abc-123');
  expect(mockResetShareIntent).toHaveBeenCalled();
});

it('shows a clean alert and does not navigate when the video cannot be resolved (e.g. backend 422 on a deleted/invalid youtube_id)', async () => {
  mockShareIntentState = {
    hasShareIntent: true,
    shareIntent: { webUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  };
  mockGetOrCreate.mockRejectedValue(new Error('API error: 422 — could not resolve youtube_id'));
  renderHook(() => useShareIntentRouter());
  await waitFor(() => expect(mockAlert).toHaveBeenCalled());
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockResetShareIntent).toHaveBeenCalled();
});

it('completes the resolve even through a burst of unrelated re-renders (regression: effect must not key off shareIntent object identity, which changes every call)', async () => {
  mockShareIntentState = {
    hasShareIntent: true,
    shareIntent: { webUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  };
  let resolveGetOrCreate: (v: { public_id: string }) => void;
  mockGetOrCreate.mockReturnValue(new Promise((resolve) => { resolveGetOrCreate = resolve; }));

  const { rerender } = renderHook(() => useShareIntentRouter());
  // Several re-renders while the fetch is still in flight, exactly as sign-in's
  // navigation/auth-state cascade produces in the real app. Each call above already
  // hands back a fresh shareIntent object, so this exercises real identity churn.
  for (let i = 0; i < 5; i++) {
    await act(async () => {});
    rerender(undefined);
  }
  resolveGetOrCreate!({ public_id: 'abc-123' });
  await waitFor(() => expect(mockPush).toHaveBeenCalled());

  expect(mockGetOrCreate).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(modals)/quickLog?essayId=abc-123');
});

it('resumes a held signed-out share even if the owning component remounts before sign-in completes (regression: observed live — Clerk session activation remounts the subtree, wiping useState/useRef)', async () => {
  mockIsSignedIn = false;
  mockShareIntentState = {
    hasShareIntent: true,
    shareIntent: { webUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  };
  mockGetOrCreate.mockResolvedValue({ public_id: 'abc-123' });

  const first = renderHook(() => useShareIntentRouter());
  await act(async () => {});
  first.unmount();

  // Simulate the subtree remount: a brand-new component instance, any React-local
  // state (useState/useRef) from `first` is gone — only module-level state survives.
  mockIsSignedIn = true;
  mockShareIntentState = { hasShareIntent: false, shareIntent: {} };
  renderHook(() => useShareIntentRouter());

  await waitFor(() => expect(mockPush).toHaveBeenCalled());
  expect(mockGetOrCreate).toHaveBeenCalledWith('dQw4w9WgXcQ', 'tok');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/quickLog?essayId=abc-123');
  expect(mockResetShareIntent).toHaveBeenCalled();
});
