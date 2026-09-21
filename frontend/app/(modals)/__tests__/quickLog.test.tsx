/**
 * Quick-log sheet.
 *
 * Closing the sheet after setting a rating creates exactly one log and dismisses the
 * screen; closing without a rating creates nothing. A re-render while the create request
 * is in flight (useAuthPost hands back a fresh function every render) must not create a
 * second log. The bottom sheet, rating screen and network are stubbed.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';

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
  useNavigation: () => ({}),
}));

const mockCreateLog = jest.fn();
jest.mock('@/src/api/logs', () => ({
  createLog: (...args: unknown[]) => mockCreateLog(...args),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));

let sheetProps: { onChange: (index: number) => void } | undefined;
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { onChange: (index: number) => void; children: React.ReactNode }) => {
      sheetProps = props;
      return <View>{props.children}</View>;
    },
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

type QuickLogProps = {
  onRatingChange: (v: number) => void;
  onRatingSetChange: (b: boolean) => void;
  onAddReview: () => void;
};
let quickLogProps: QuickLogProps | undefined;
jest.mock('@/src/screens/QuickLogScreen', () => (props: QuickLogProps) => {
  quickLogProps = props;
  return null;
});
jest.mock('@/src/screens/createLogScreen', () => () => null);
jest.mock('@/src/screens/GetVideoEssayScreen', () => () => null);
jest.mock('@/components/ui/reviewsTopNav', () => ({ ReviewsTopNav: () => null }));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: (props: Record<string, unknown>) => <View {...props} /> };
});

import QuickLog from '../quickLog';

jest.setTimeout(20000);

function rate(value: number) {
  act(() => {
    quickLogProps!.onRatingChange(value);
    quickLogProps!.onRatingSetChange(true);
  });
}

function closeSheet() {
  act(() => {
    sheetProps!.onChange(-1);
  });
}

describe('quickLog sheet close', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateLog.mockResolvedValue({});
  });

  it('creates one log with the chosen rating, then dismisses', async () => {
    render(<QuickLog />);
    rate(4);
    closeSheet();

    await act(async () => {});
    expect(mockCreateLog).toHaveBeenCalledTimes(1);
    expect(mockCreateLog.mock.calls[0][1]).toMatchObject({ essay: 'essay-123', rating: 4 });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('creates nothing when the sheet closes without a rating', async () => {
    render(<QuickLog />);
    closeSheet();

    await act(async () => {});
    expect(mockCreateLog).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('does not create a second log if the screen re-renders mid-request', async () => {
    let resolveCreate: () => void = () => {};
    mockCreateLog.mockImplementation(
      () => new Promise<void>((resolve) => { resolveCreate = resolve; }),
    );
    const { rerender } = render(<QuickLog />);
    rate(3);
    closeSheet();
    rerender(<QuickLog />);
    rerender(<QuickLog />);

    await act(async () => { resolveCreate(); });
    expect(mockCreateLog).toHaveBeenCalledTimes(1);
  });

  it('hands off to the full review modal without also auto-saving a quick log', async () => {
    render(<QuickLog />);
    rate(4);
    act(() => {
      quickLogProps!.onAddReview();
    });
    closeSheet();

    await act(async () => {});
    expect(mockCreateLog).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/logVideoModal',
      params: { essayId: 'essay-123', rating: '4' },
    });
  });
});
