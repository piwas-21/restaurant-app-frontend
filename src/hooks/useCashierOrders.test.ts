import { act, renderHook, waitFor } from '@testing-library/react';
import { useCashierOrders } from './useCashierOrders';
import { getCashierOrders, getOrderById, refundPayment } from '@/services/cashierService';
import { ApiError } from '@/utils/apiClient';
import type { CashierOrdersQuery } from './cashier/useCashierFilters';

jest.mock('@/services/cashierService', () => ({
  getCashierOrders: jest.fn(),
  getOrderById: jest.fn(),
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
const mockGetOrderById = getOrderById as jest.Mock;
const mockRefundPayment = refundPayment as jest.Mock;

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
describe('useCashierOrders — server-paged queue', () => {
  it('sends a search to the server so an order beyond an unfiltered first page is found', async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) => ({
      id: `o${index + 1}`,
      orderNumber: `${index + 1}`,
      status: 'Pending',
    }));
    const laterOrder = { id: 'o11', orderNumber: 'later-order', status: 'Pending' };
    const initialQuery: CashierOrdersQuery = { page: 1, pageSize: 10 };

    mockGetCashierOrders
      .mockResolvedValueOnce({ items: firstPage, totalCount: 11, page: 1, pageSize: 10, totalPages: 2 })
      .mockResolvedValueOnce({ items: [laterOrder], totalCount: 1, page: 1, pageSize: 10, totalPages: 1 });

    const { result, rerender } = renderHook(({ query }) => useCashierOrders(undefined, query), {
      initialProps: { query: initialQuery },
    });
    await waitFor(() => expect(result.current.orders).toHaveLength(10));

    rerender({ query: { ...initialQuery, search: 'later-order' } });

    await waitFor(() =>
      expect(mockGetCashierOrders).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, search: 'later-order' }),
    );
    await waitFor(() => expect(result.current.orders.map((order) => order.id)).toEqual(['o11']));
    expect(result.current.pagination.totalCount).toBe(1);
  });
});

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

describe('useCashierOrders — refund response lifecycle', () => {
  it('fetches and merges the authoritative order instead of spreading payment id or status into it', async () => {
    const refundedPayment = {
      id: 'payment-99',
      orderId: 'o1',
      paymentMethod: 'Cash',
      amount: 18,
      status: 'Refunded',
    };
    const authoritativeOrder = {
      id: 'o1',
      status: 'Confirmed',
      paymentStatus: 'Refunded',
    };
    mockRefundPayment.mockResolvedValue(refundedPayment);
    mockGetOrderById.mockResolvedValue(authoritativeOrder);

    const { result } = renderHook(() => useCashierOrders());
    await waitFor(() => expect(mockGetCashierOrders).toHaveBeenCalled());

    let returnedOrder: typeof authoritativeOrder | undefined;
    await act(async () => {
      returnedOrder = await result.current.refundPayment('o1', 'payment-99', 18);
    });

    expect(mockRefundPayment).toHaveBeenCalledWith('o1', 'payment-99', 18);
    expect(mockGetOrderById).toHaveBeenCalledWith('o1');
    expect(returnedOrder).toEqual(authoritativeOrder);
    expect(result.current.orders).toEqual([authoritativeOrder]);
    expect(result.current.orders[0]).not.toMatchObject({ id: refundedPayment.id, status: refundedPayment.status });
  });
});
