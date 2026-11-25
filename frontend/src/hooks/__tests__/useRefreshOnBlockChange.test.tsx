/**
 * Screens that list other people's content reload when the user blocks or unblocks someone,
 * so a blocked user's rows leave an already-mounted feed.
 */
import { act, renderHook } from '@testing-library/react-native';

import { notifyBlockChanged } from '@/src/helpers/blockEvents';
import { useRefreshOnBlockChange } from '../useRefreshOnBlockChange';

describe('useRefreshOnBlockChange', () => {
  it('calls reload each time a block changes', () => {
    const reload = jest.fn();
    renderHook(() => useRefreshOnBlockChange(reload));

    act(() => notifyBlockChanged());
    act(() => notifyBlockChanged());

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('calls the latest reload, not the one from the first render', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ fn }: { fn: () => void }) => useRefreshOnBlockChange(fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });

    act(() => notifyBlockChanged());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', () => {
    const reload = jest.fn();
    const { unmount } = renderHook(() => useRefreshOnBlockChange(reload));
    unmount();

    act(() => notifyBlockChanged());

    expect(reload).not.toHaveBeenCalled();
  });
});
