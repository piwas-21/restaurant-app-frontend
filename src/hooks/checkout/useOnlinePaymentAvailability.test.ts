/**
 * useOnlinePaymentAvailability — SOFRA-PAYMENTS-PLAN §5 S8.
 *
 * The hook's docblock makes two claims that nothing else in the repo pins, so they are pinned
 * here: it starts at **false** rather than at an "unknown", and it does not set state after
 * unmount. Both are one-word edits away from being wrong, and neither would fail tsc or lint.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useOnlinePaymentAvailability } from './useOnlinePaymentAvailability';
import { getOnlinePaymentAvailability } from '@/services/paymentService';

jest.mock('@/services/paymentService', () => ({ getOnlinePaymentAvailability: jest.fn() }));

const mockAvailability = getOnlinePaymentAvailability as jest.MockedFunction<typeof getOnlinePaymentAvailability>;

describe('useOnlinePaymentAvailability', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts false, before the answer arrives', () => {
    // Load-bearing: the whole fleet answers no today, so an optimistic initial value would render
    // a payment option that then vanishes — worse than a beat of not seeing it.
    let resolve: (value: boolean) => void = () => {};
    mockAvailability.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));

    const { result } = renderHook(() => useOnlinePaymentAvailability());

    expect(result.current).toBe(false);
    act(() => resolve(true));
  });

  it('becomes true once the server says so', async () => {
    mockAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useOnlinePaymentAvailability());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false when the server says no', async () => {
    mockAvailability.mockResolvedValue(false);

    const { result } = renderHook(() => useOnlinePaymentAvailability());

    await waitFor(() => expect(mockAvailability).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('asks exactly once per mount', async () => {
    mockAvailability.mockResolvedValue(true);

    const { result, rerender } = renderHook(() => useOnlinePaymentAvailability());
    await waitFor(() => expect(result.current).toBe(true));
    rerender();
    rerender();

    expect(mockAvailability).toHaveBeenCalledTimes(1);
  });

  it('does not set state after unmount', async () => {
    // /checkout/review redirects away on its own prereq guard, so this race is real rather than
    // theoretical. React logs an error on a post-unmount setState; assert none was logged.
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    let resolve: (value: boolean) => void = () => {};
    mockAvailability.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));

    const { unmount } = renderHook(() => useOnlinePaymentAvailability());
    unmount();
    await act(async () => {
      resolve(true);
    });

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
