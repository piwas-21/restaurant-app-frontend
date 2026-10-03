import { act, renderHook } from '@testing-library/react';
import { useGuestPaymentWorkGate } from './useGuestPaymentWorkGate';

describe('useGuestPaymentWorkGate', () => {
  it('blocks same-turn duplicate mutations before the first request settles', async () => {
    let finish!: (value: boolean) => void;
    const firstOperation = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const duplicateOperation = jest.fn(async () => true);
    const { result } = renderHook(() => useGuestPaymentWorkGate());
    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;

    act(() => {
      first = result.current.runExclusive(firstOperation, false);
      duplicate = result.current.runExclusive(duplicateOperation, false);
    });

    expect(firstOperation).toHaveBeenCalledTimes(1);
    expect(duplicateOperation).not.toHaveBeenCalled();
    expect(result.current.isWorking).toBe(true);
    await expect(duplicate).resolves.toBe(false);

    await act(async () => {
      finish(true);
      await first;
    });
    expect(result.current.isWorking).toBe(false);
  });
});
