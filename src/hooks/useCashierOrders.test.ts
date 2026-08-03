import { act, renderHook, waitFor } from '@testing-library/react';
import { useCashierOrders } from './useCashierOrders';
import { getCashierOrders } from '@/services/cashierService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/cashierService', () => ({
  getCashierOrders: jest.fn(),
  updateOrderStatus: jest.fn(),
  addPaymentToOrder: jest.fn(),
  refundPayment: jest.fn(),
  cancelOrder: jest.fn(),
  toggleFocusOrder: jest.fn(),
}));
jest.mock('./cashier/useCashierOrdersStream', () => ({
  useCashierOrdersStream: () => ({
    isConnected: true,
    error: null,
    lastEventTime: null,
    connectionState: 'connected',
  }),
}));

const mockGetCashierOrders = getCashierOrders as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCashierOrders.mockResolvedValue({ items: [{ id: 'o1', status: 'Pending' }] });
});

/**
 * `refreshOrders` resolves on BOTH paths — it captures the failure into `error` and never rejects.
 * That is right for the effects and the poll that call it, but it left the manual-refresh handler
 * on the cashier page unable to tell the two apart: it awaited, then announced "Orders refreshed"
 * over the top of the error banner, and the `catch` it had written for the failure was
 * unreachable. The boolean is the only thing that distinguishes them (E9 slice 8).
 */
describe('useCashierOrders — refreshOrders reports its outcome', () => {
  it('resolves true and leaves `error` clear when the fetch lands', async () => {
    const { result } = renderHook(() => useCashierOrders());
    await waitFor(() => expect(mockGetCashierOrders).toHaveBeenCalled());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.refreshOrders();
    });

    expect(outcome).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('resolves false — and does NOT reject — when the fetch fails', async () => {
    const { result } = renderHook(() => useCashierOrders());
    await waitFor(() => expect(mockGetCashierOrders).toHaveBeenCalled());

    mockGetCashierOrders.mockRejectedValue(new ApiError(503, 'Till service unavailable'));
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.refreshOrders();
    });

    expect(outcome).toBe(false);
    // Still reported where it always was — the boolean adds a caller signal, it does not move
    // the message.
    expect(result.current.error).toBe('Till service unavailable');
  });
});
