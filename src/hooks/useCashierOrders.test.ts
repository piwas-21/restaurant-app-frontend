import { act, renderHook, waitFor } from '@testing-library/react';
import { useCashierOrders } from './useCashierOrders';
import { getCashierOrderGroups, getOrderById, getPaymentOperation, refundPayment } from '@/services/cashierService';
import { ApiError } from '@/utils/apiClient';
import type { CashierOrdersQuery } from './cashier/useCashierFilters';

jest.mock('@/services/cashierService', () => ({
  getCashierOrderGroups: jest.fn(),
  getOrderById: jest.fn(),
  updateOrderStatus: jest.fn(),
  addPaymentToOrder: jest.fn(),
  getPaymentOperation: jest.fn(),
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

const mockGetCashierOrderGroups = getCashierOrderGroups as jest.Mock;
const mockGetOrderById = getOrderById as jest.Mock;
const mockGetPaymentOperation = getPaymentOperation as jest.Mock;
const mockRefundPayment = refundPayment as jest.Mock;

type OrderStub = { id: string; [key: string]: unknown };

function groupPage(
  orders: readonly OrderStub[],
  page = 1,
  pageSize = 50,
  totalCount = orders.length,
  totalPages = Math.ceil(totalCount / pageSize),
) {
  return {
    items: orders.map((order) => ({
      groupKey: `order:${order.id}`,
      serviceSessionId: null,
      tableNumber: null,
      releasedAt: null,
      isArchivedFromTable: false,
      orders: [order],
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCashierOrderGroups.mockResolvedValue(groupPage([{ id: 'o1', status: 'Pending' }]));
});

/**
 * `refreshOrders` resolves on BOTH paths — it captures the failure into `error` and never rejects.
 * That is right for the effects and the poll that call it, but it left the manual-refresh handler
 * on the cashier page unable to tell the two apart: it awaited, then announced "Orders refreshed"
 * over the top of the error banner, and the `catch` it had written for the failure was
 * unreachable. The boolean is the only thing that distinguishes them (E9 slice 8).
 */
describe('useCashierOrders — server-paged queue', () => {
  it('keeps every child order inside a visit even when one group fills the page', async () => {
    const children = [
      { id: 'round-1', orderNumber: 'O-1' },
      { id: 'round-2', orderNumber: 'O-2' },
    ];
    mockGetCashierOrderGroups.mockResolvedValueOnce({
      items: [
        {
          groupKey: 'visit:session-7',
          serviceSessionId: 'session-7',
          tableNumber: 14,
          releasedAt: '2026-10-08T12:00:00Z',
          isArchivedFromTable: false,
          orders: children,
        },
      ],
      totalCount: 3,
      page: 1,
      pageSize: 1,
      totalPages: 3,
    });

    const { result } = renderHook(() => useCashierOrders({ page: 1, pageSize: 1 }));

    await waitFor(() => expect(result.current.groups).toHaveLength(1));
    expect(result.current.groups[0]).toMatchObject({
      groupKey: 'visit:session-7',
      serviceSessionId: 'session-7',
      tableNumber: 14,
      releasedAt: '2026-10-08T12:00:00Z',
    });
    expect(result.current.groups[0].orders.map((order) => order.id)).toEqual(['round-1', 'round-2']);
    expect(result.current.orders.map((order) => order.orderNumber)).toEqual(['O-1', 'O-2']);
    expect(result.current.pagination).toMatchObject({ totalCount: 3, pageSize: 1, totalPages: 3 });
  });

  it('sends a search to the server so an order beyond an unfiltered first page is found', async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) => ({
      id: `o${index + 1}`,
      orderNumber: `${index + 1}`,
      status: 'Pending',
    }));
    const laterOrder = { id: 'o11', orderNumber: 'later-order', status: 'Pending' };
    const initialQuery: CashierOrdersQuery = { page: 1, pageSize: 10 };

    mockGetCashierOrderGroups
      .mockResolvedValueOnce(groupPage(firstPage, 1, 10, 11, 2))
      .mockResolvedValueOnce(groupPage([laterOrder], 1, 10, 1, 1));

    const { result, rerender } = renderHook(({ query }) => useCashierOrders(query), {
      initialProps: { query: initialQuery },
    });
    await waitFor(() => expect(result.current.orders).toHaveLength(10));

    rerender({ query: { ...initialQuery, search: 'later-order' } });

    await waitFor(() =>
      expect(mockGetCashierOrderGroups).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        search: 'later-order',
        scope: 'Operational',
      }),
    );
    await waitFor(() => expect(result.current.orders.map((order) => order.id)).toEqual(['o11']));
    expect(result.current.pagination.totalCount).toBe(1);
  });

  it('asks the controlled marketplace queue to leave an emptied last page after a row is removed', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `market-${index + 1}`,
      orderNumber: `${index + 1}`,
      status: 'PendingApproval',
    }));
    const onPageChange = jest.fn();
    const pageTwoQuery: CashierOrdersQuery = {
      page: 2,
      pageSize: 20,
      marketplaceOnly: true,
      status: 'PendingApproval',
    };
    mockGetCashierOrderGroups
      .mockResolvedValueOnce(groupPage(rows.slice(20), 2, 20, 21, 2))
      .mockResolvedValueOnce(groupPage([], 2, 20, 20, 1))
      .mockResolvedValueOnce(groupPage(rows.slice(0, 20), 1, 20, 20, 1));

    const { result, rerender } = renderHook(({ query }) => useCashierOrders(query, onPageChange), {
      initialProps: { query: pageTwoQuery },
    });
    await waitFor(() => expect(result.current.orders.map((order) => order.id)).toEqual(['market-21']));

    await act(async () => {
      expect(await result.current.refreshOrders()).toBe(false);
    });
    expect(onPageChange).toHaveBeenCalledWith(1);
    rerender({ query: { ...pageTwoQuery, page: 1 } });

    await waitFor(() => {
      expect(result.current.orders).toHaveLength(20);
      expect(result.current.pagination.totalCount).toBe(20);
      expect(result.current.pagination.totalPages).toBe(1);
    });
  });
});

describe('useCashierOrders — refreshOrders reports its outcome', () => {
  it('resolves true and leaves `error` clear when the fetch lands', async () => {
    const { result } = renderHook(() => useCashierOrders());
    await waitFor(() => expect(mockGetCashierOrderGroups).toHaveBeenCalled());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.refreshOrders();
    });

    expect(outcome).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('resolves false — and does NOT reject — when the fetch fails', async () => {
    const { result } = renderHook(() => useCashierOrders());
    await waitFor(() => expect(mockGetCashierOrderGroups).toHaveBeenCalled());

    mockGetCashierOrderGroups.mockRejectedValue(new ApiError(503, 'Till service unavailable'));
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.refreshOrders();
    });

    expect(outcome).toBe(false);
    // Still reported where it always was — the boolean adds a caller signal, it does not move
    // the message.
    expect(result.current.error).toBe('Till service unavailable');
    expect(result.current.queueState).toBe('stale');
  });
});

describe('useCashierOrders — snapshot availability and races', () => {
  it('reports unavailable when the first snapshot fails', async () => {
    mockGetCashierOrderGroups.mockRejectedValueOnce(new ApiError(503, 'Till unavailable'));
    const { result } = renderHook(() => useCashierOrders());

    await waitFor(() => expect(result.current.queueState).toBe('unavailable'));
    expect(result.current.orders).toEqual([]);
  });

  it('treats a successful empty page as ready rather than unavailable', async () => {
    mockGetCashierOrderGroups.mockResolvedValueOnce(groupPage([], 1, 50, 0, 0));
    const { result } = renderHook(() => useCashierOrders());

    await waitFor(() => expect(result.current.queueState).toBe('ready'));
    expect(result.current.orders).toEqual([]);
  });

  it('keeps the last usable page and marks it stale after a transient failure', async () => {
    const { result } = renderHook(() => useCashierOrders());
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    mockGetCashierOrderGroups.mockRejectedValueOnce(new ApiError(503, 'Till unavailable'));
    await act(async () => {
      await result.current.refreshOrders();
    });

    expect(result.current.orders).toEqual([{ id: 'o1', status: 'Pending' }]);
    expect(result.current.queueState).toBe('stale');
  });

  it('lets the newest response win when an older response resolves later', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    let resolveSecond: (value: unknown) => void = () => undefined;
    mockGetCashierOrderGroups.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockGetCashierOrderGroups.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );

    const { result, rerender } = renderHook(({ query }) => useCashierOrders(query), {
      initialProps: { query: { page: 1, pageSize: 10 } as CashierOrdersQuery },
    });
    await waitFor(() => expect(mockGetCashierOrderGroups).toHaveBeenCalledTimes(1));
    rerender({ query: { page: 1, pageSize: 10, search: 'new' } });
    await waitFor(() => expect(mockGetCashierOrderGroups).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond(groupPage([{ id: 'newer' }], 1, 10, 1, 1));
    });
    await waitFor(() => expect(result.current.orders.map((order) => order.id)).toEqual(['newer']));

    await act(async () => {
      resolveFirst(groupPage([{ id: 'older' }], 1, 10, 1, 1));
    });
    expect(result.current.orders.map((order) => order.id)).toEqual(['newer']);
    expect(result.current.queueState).toBe('ready');
  });
});

describe('useCashierOrders — payment reconciliation lifecycle', () => {
  it('merges the authoritative order returned by an operation lookup', async () => {
    const authoritativeOrder = { id: 'o1', status: 'Completed', paymentStatus: 'Completed' };
    mockGetPaymentOperation.mockResolvedValueOnce({
      operationId: 'op-1',
      status: 'Committed',
      payment: { id: 'p1' },
      order: authoritativeOrder,
    });

    const { result } = renderHook(() => useCashierOrders());
    await waitFor(() => expect(mockGetCashierOrderGroups).toHaveBeenCalled());

    let reconciliation;
    await act(async () => {
      reconciliation = await result.current.reconcilePayment('o1', 'op-1');
    });

    expect(mockGetPaymentOperation).toHaveBeenCalledWith('o1', 'op-1');
    expect(reconciliation).toMatchObject({ status: 'Committed', order: authoritativeOrder });
    expect(result.current.orders).toEqual([authoritativeOrder]);
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
    await waitFor(() => expect(mockGetCashierOrderGroups).toHaveBeenCalled());

    let returnedOrder: typeof authoritativeOrder | undefined;
    await act(async () => {
      returnedOrder = await result.current.refundPayment('o1', 'payment-99', 18, 'Customer request');
    });

    expect(mockRefundPayment).toHaveBeenCalledWith('o1', 'payment-99', 18, 'Customer request');
    expect(mockGetOrderById).toHaveBeenCalledWith('o1');
    expect(returnedOrder).toEqual(authoritativeOrder);
    expect(result.current.orders).toEqual([authoritativeOrder]);
    expect(result.current.orders[0]).not.toMatchObject({ id: refundedPayment.id, status: refundedPayment.status });
  });
});
