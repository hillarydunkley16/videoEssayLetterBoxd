/**
 * Search screen "log mode".
 *
 * Reached from the mobile Log tab via `?mode=log`: tapping a result opens the quick-log
 * sheet for that essay. Without `mode=log` (top search bar) a tap still opens the full log
 * modal. Clerk, the network and navigation are stubbed.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

const mockSearchDataBase = jest.fn();
const mockCallSerpAPI = jest.fn();
const mockConvert = jest.fn();
jest.mock('@/src/api/videos', () => ({
  searchDataBase: (...args: unknown[]) => mockSearchDataBase(...args),
  callSerpAPI: (...args: unknown[]) => mockCallSerpAPI(...args),
  useVideoApi: () => ({ convertYouTubeResultToVideoEssay: (...a: unknown[]) => mockConvert(...a) }),
}));

import SearchScreen from '../SearchScreen';

jest.setTimeout(20000);

const dbResult = {
  source: 'database',
  video: { public_id: 'db-1', title: 'Database Essay', channel_name: 'Chan', thumbnail: null },
};
const ytResult = {
  source: 'api',
  video: { title: 'YouTube Essay', thumbnail: null },
};

beforeEach(() => {
  mockPush.mockClear();
  mockSearchDataBase.mockReset().mockResolvedValue([dbResult]);
  mockCallSerpAPI.mockReset().mockResolvedValue([]);
  mockConvert.mockReset();
});

describe('SearchScreen log mode', () => {
  it('sends a database result to quickLog in log mode', async () => {
    mockParams = { q: 'essay', mode: 'log' };
    render(<SearchScreen />);

    fireEvent.press(await screen.findByText('Database Essay'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/quickLog',
      params: { essayId: 'db-1' },
    });
  });

  it('converts a YouTube result, then sends it to quickLog in log mode', async () => {
    mockParams = { q: 'essay', mode: 'log', submittedAt: '1' };
    mockSearchDataBase.mockResolvedValue([]);
    mockCallSerpAPI.mockResolvedValue([ytResult]);
    mockConvert.mockResolvedValue({ source: 'database', video: { public_id: 'new-9' } });
    render(<SearchScreen />);

    fireEvent.press(await screen.findByText('YouTube Essay'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/quickLog',
        params: { essayId: 'new-9' },
      }),
    );
    expect(mockConvert).toHaveBeenCalledWith(ytResult.video);
  });

  it('still opens logVideoModal without log mode', async () => {
    mockParams = { q: 'essay' };
    render(<SearchScreen />);

    fireEvent.press(await screen.findByText('Database Essay'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/logVideoModal',
      params: { essayId: 'db-1' },
    });
  });

  it('shows log-mode empty-state copy', () => {
    mockParams = { mode: 'log' };
    render(<SearchScreen />);

    expect(screen.getByText('Search for the essay you want to log')).toBeTruthy();
  });

  it('keeps the default empty-state copy outside log mode', () => {
    mockParams = {};
    render(<SearchScreen />);

    expect(screen.getByText(/Search for video essays by title/)).toBeTruthy();
  });
});
