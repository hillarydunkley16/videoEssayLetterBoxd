/**
 * Prove-It test for the duplicate-log bug.
 *
 * Double-tapping "Save Log" in the modal used to fire POST /api/logList/
 * once per tap, creating a log row per tap. The handler must now create the
 * log at most once per open and dismiss the modal on success.
 *
 * Every child of the modal is stubbed so the test exercises only the submit
 * handler (no Clerk, no network, no nested screens).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

let mockParams: Record<string, string> = { essayId: 'essay-123' };
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Link: 'Link',
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
}));

const mockCreateLog = jest.fn();
const mockUpdateLog = jest.fn();
const mockFetchALog = jest.fn();
jest.mock('@/src/api/logs', () => ({
  createLog: (...args: unknown[]) => mockCreateLog(...args),
  updateLog: (...args: unknown[]) => mockUpdateLog(...args),
  fetchALog: (...args: unknown[]) => mockFetchALog(...args),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/authUpdate', () => ({ useAuthUpdate: () => jest.fn() }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }));
jest.mock('@/src/api/client', () => ({ authFetch: jest.fn() }));

const mockFormProps = jest.fn();
jest.mock('@/src/screens/createLogScreen', () => (props: Record<string, unknown>) => {
  mockFormProps(props);
  return null;
});
jest.mock('@/src/screens/GetVideoEssayScreen', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: (props: Record<string, unknown>) => <Text {...props} /> };
});

import LogVideoModal from '../logVideoModal';

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

describe('logVideoModal Save button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { essayId: 'essay-123' };
  });

  it('starts from the rating handed over from the quick-log sheet', async () => {
    mockParams = { essayId: 'essay-123', rating: '4' };
    mockCreateLog.mockResolvedValue(undefined);

    render(<LogVideoModal />);
    fireEvent.press(screen.getByText('Save Log'));

    await waitFor(() => expect(mockCreateLog).toHaveBeenCalledTimes(1));
    expect(mockCreateLog.mock.calls[0][1]).toMatchObject({ essay: 'essay-123', rating: 4 });
  });

  it('creates the log only once when Save is double-tapped, then dismisses', async () => {
    let resolveCreate: () => void = () => {};
    mockCreateLog.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<LogVideoModal />);
    const save = screen.getByText('Save Log');

    // Two taps landing before the first request resolves.
    fireEvent.press(save);
    fireEvent.press(save);

    // The second tap must not have fired another createLog.
    expect(mockCreateLog).toHaveBeenCalledTimes(1);

    resolveCreate();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'), { timeout: 10000 });

    // Still exactly one after the request settles and the modal dismisses.
    expect(mockCreateLog).toHaveBeenCalledTimes(1);
  });

  it('re-enables submission after a failed save', async () => {
    mockCreateLog
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    render(<LogVideoModal />);

    fireEvent.press(screen.getByText('Save Log'));
    await waitFor(() => expect(mockCreateLog).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText('Save Log'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));

    expect(mockCreateLog).toHaveBeenCalledTimes(2);
  });
});

describe('logVideoModal edit mode (?logId=)', () => {
  const existingLog = {
    public_id: 'log-1',
    essay_details: { public_id: 'essay-9' },
    rating: 3,
    review_text: 'pretty good',
    date: '2026-03-05',
    rewatch: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { logId: 'log-1' };
    mockFetchALog.mockResolvedValue(existingLog);
  });

  it('pre-fills the form from the existing log, keeping the calendar day', async () => {
    render(<LogVideoModal />);

    await waitFor(() => expect(screen.getByText('Save changes')).toBeTruthy());
    const props = mockFormProps.mock.calls[mockFormProps.mock.calls.length - 1][0];
    expect(props).toMatchObject({ id: 'essay-9', initialRating: 3, reviewText: 'pretty good', rewatch: true });
    const d = props.date as Date;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 5]);
  });

  it('PATCHes once (no essay) when Save is double-tapped, then goes back', async () => {
    let resolveUpdate: () => void = () => {};
    mockUpdateLog.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<LogVideoModal />);
    await waitFor(() => expect(screen.getByText('Save changes')).toBeTruthy());
    const save = screen.getByText('Save changes');
    fireEvent.press(save);
    fireEvent.press(save);

    expect(mockUpdateLog).toHaveBeenCalledTimes(1);
    const [id, payload] = mockUpdateLog.mock.calls[0];
    expect(id).toBe('log-1');
    expect(payload).toEqual({ rating: 3, review_text: 'pretty good', rewatch: true, date: '2026-03-05' });

    resolveUpdate();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockCreateLog).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows an error and allows retry when the update fails', async () => {
    mockUpdateLog.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined);

    render(<LogVideoModal />);
    await waitFor(() => expect(screen.getByText('Save changes')).toBeTruthy());

    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(screen.getByText(/Couldn't save/)).toBeTruthy());

    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockUpdateLog).toHaveBeenCalledTimes(2);
  });

  it('shows an error when the log cannot be loaded', async () => {
    mockFetchALog.mockRejectedValueOnce(new Error('404'));
    render(<LogVideoModal />);
    await waitFor(() => expect(screen.getByText(/Couldn't load this log/)).toBeTruthy());
  });
});
