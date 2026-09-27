import { renderHook, waitFor } from '@testing-library/react';
import { getOptionSetProductVariations } from '@/services/optionSetReferenceService';
import { useOptionSetProductVariations } from './useOptionSetProductVariations';

jest.mock('@/services/optionSetReferenceService', () => ({
  isOptionSetReferenceAvailable: jest.fn(),
  getOptionSetProductVariations: jest.fn(),
}));

describe('useOptionSetProductVariations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not fetch until the variation list is requested', () => {
    const { result } = renderHook(() => useOptionSetProductVariations('product-1', false));

    expect(result.current).toEqual({ variations: [], isLoading: false, error: false });
    expect(getOptionSetProductVariations).not.toHaveBeenCalled();
  });

  it('aborts an in-flight lookup when the row no longer needs it', async () => {
    (getOptionSetProductVariations as jest.Mock).mockImplementation(
      (_productId: string, signal: AbortSignal) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const { rerender, result } = renderHook(
      ({ enabled }: { enabled: boolean }) => useOptionSetProductVariations('product-1', enabled),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(getOptionSetProductVariations).toHaveBeenCalledTimes(1));
    const signal = (getOptionSetProductVariations as jest.Mock).mock.calls[0][1] as AbortSignal;
    rerender({ enabled: false });

    await waitFor(() => expect(signal.aborted).toBe(true));
    expect(result.current.error).toBe(false);
  });
});
