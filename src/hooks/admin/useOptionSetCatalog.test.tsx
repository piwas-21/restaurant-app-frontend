import { act, renderHook } from '@testing-library/react';
import { searchOptionSets } from '@/services/optionSetService';
import { useOptionSetCatalog } from './useOptionSetCatalog';

jest.mock('@/services/optionSetService', () => ({ searchOptionSets: jest.fn() }));

describe('useOptionSetCatalog request cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (searchOptionSets as jest.Mock).mockImplementation(
      (_filters: unknown, signal: AbortSignal) =>
        new Promise((resolve) => signal.addEventListener('abort', () => resolve({ items: [], nextCursor: null }))),
    );
  });

  afterEach(() => jest.useRealTimers());

  it('aborts a catalogue search when its query effect is replaced', async () => {
    const { result } = renderHook(() => useOptionSetCatalog());
    await act(async () => jest.advanceTimersByTime(250));
    expect(searchOptionSets).toHaveBeenCalledTimes(1);
    const signal = (searchOptionSets as jest.Mock).mock.calls[0][1] as AbortSignal;

    act(() => result.current.setQuery('salad'));

    expect(signal.aborted).toBe(true);
  });

  it('aborts a pending catalogue search when the hook unmounts', async () => {
    const { unmount } = renderHook(() => useOptionSetCatalog());
    await act(async () => jest.advanceTimersByTime(250));
    const signal = (searchOptionSets as jest.Mock).mock.calls[0][1] as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
