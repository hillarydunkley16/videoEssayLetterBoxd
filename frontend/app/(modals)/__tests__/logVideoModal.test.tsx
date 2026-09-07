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

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Link: 'Link',
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => ({ essayId: 'essay-123' }),
}));

const mockCreateLog = jest.fn();
jest.mock('@/src/api/logs', () => ({
  createLog: (...args: unknown[]) => mockCreateLog(...args),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/client', () => ({ authFetch: jest.fn() }));

jest.mock('@/src/screens/createLogScreen', () => () => null);
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
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1), { timeout: 10000 });

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
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));

    expect(mockCreateLog).toHaveBeenCalledTimes(2);
  });
});
