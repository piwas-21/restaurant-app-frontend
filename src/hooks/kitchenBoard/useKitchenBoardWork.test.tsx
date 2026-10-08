import { act, renderHook, waitFor } from '@testing-library/react';
import { completeKitchenBoardWork, getKitchenBoardWork } from '@/services/kitchenBoardService';
import { updateOrderStatus } from '@/services/order/orderCommands';
import type { KitchenBoardOrder, KitchenBoardWorkFeed } from '@/types/kitchenBoard';
import type { OrderDto } from '@/types/order';
import { useKitchenBoardWork } from './useKitchenBoardWork';

jest.mock('@/services/kitchenBoardService');
jest.mock('@/services/order/orderCommands');
jest.mock('@/lib/config', () => ({
  ...jest.requireActual<typeof import('@/lib/config')>('@/lib/config'),
  KITCHEN_BOARD_SYNC_INTERVAL_MS: 27_500,
}));

const mockGetWork = getKitchenBoardWork as jest.MockedFunction<typeof getKitchenBoardWork>;
const mockCompleteWork = completeKitchenBoardWork as jest.MockedFunction<typeof completeKitchenBoardWork>;
const mockUpdateOrderStatus = updateOrderStatus as jest.MockedFunction<typeof updateOrderStatus>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function kitchenOrder(status: string, version: number): KitchenBoardOrder {
  return {
    orderId: 'order-b',
    orderNumber: 'B-1',
    type: 'DineIn',
    status,
    tableId: null,
    tableLabel: 'T-5',
    tableNumber: 5,
    serviceSessionId: 'visit-b',
    createdAt: '2026-10-08T12:00:00Z',
    version,
    isCompleted: false,
    completedAt: null,
    canComplete: false,
    requiredKitchenRoutes: [],
    items: [],
  };
}

function orderStatusResponse(status: string, version: number): OrderDto {
  return {
    id: 'order-b',
    orderNumber: 'B-1',
    type: 'DineIn',
    subTotal: 0,
    tax: 0,
    deliveryFee: 0,
    discount: 0,
    discountPercentage: 0,
    customerDiscountAmount: 0,
    tip: 0,
    total: 0,
    totalPaid: 0,
    remainingAmount: 0,
    isFullyPaid: true,
    status,
    paymentStatus: 'Paid',
    version,
    isFocusOrder: false,
    orderDate: '2026-10-08T12:00:00Z',
    hasUserLimitDiscount: false,
    userLimitAmount: 0,
    items: [],
    payments: [],
    statusHistory: [],
  };
}

function feedWithOrders(orders: readonly KitchenBoardOrder[]): KitchenBoardWorkFeed {
  return { ...feed, orders: { ...feed.orders, items: orders } };
}

const feed: KitchenBoardWorkFeed = {
  orders: {
    items: [],
    totalCount: 0,
    hasMore: false,
    removedIds: [],
    nextCursor: 'orders-watermark',
    watermark: 1,
    mode: 'Snapshot',
  },
  corrections: {
    items: [
      {
        workItemId: 'note-a',
        orderId: 'order-a',
        orderNumber: 'A-1',
        status: 'Delivered',
        tableId: null,
        tableLabel: 'T-4',
        tableNumber: 4,
        serviceSessionId: 'visit-a',
        amendmentId: 'amendment-a',
        accountRevision: 9,
        orderVersion: 12,
        target: null,
        summary: 'Changed one item',
        withdrawn: false,
        isCompleted: false,
        canComplete: true,
        routeStatus: 'NotConfigured',
        createdAt: '2026-10-08T12:00:00Z',
        changes: [],
      },
    ],
    totalCount: 1,
    hasMore: false,
    removedIds: [],
    nextCursor: 'corrections-watermark',
    watermark: 1,
    mode: 'Snapshot',
  },
  completions: {
    items: [],
    totalCount: 0,
    hasMore: false,
    removedIds: [],
    nextCursor: 'completions-watermark',
    watermark: 1,
    mode: 'Snapshot',
  },
};

beforeEach(() => {
  mockGetWork.mockReset();
  mockCompleteWork.mockReset();
  mockUpdateOrderStatus.mockReset();
  mockGetWork.mockResolvedValue(feed);
});

describe('useKitchenBoardWork', () => {
  it('polls at the configured cadence and stops polling on unmount', async () => {
    jest.useFakeTimers();
    try {
      const { unmount } = renderHook(() => useKitchenBoardWork(true));
      await act(async () => Promise.resolve());
      expect(mockGetWork).toHaveBeenCalledTimes(1);
      await act(async () => jest.advanceTimersByTime(27_499));
      expect(mockGetWork).toHaveBeenCalledTimes(1);
      await act(async () => jest.advanceTimersByTime(1));
      expect(mockGetWork).toHaveBeenCalledTimes(2);
      unmount();
      await act(async () => jest.advanceTimersByTime(27_500));
      expect(mockGetWork).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not request the native work feed while the workspace is disabled', async () => {
    const { result } = renderHook(() => useKitchenBoardWork(false));
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    expect(mockGetWork).not.toHaveBeenCalled();
  });

  it('starts a fresh feed generation after disable and re-enable while an older read is pending', async () => {
    const oldRead = deferred<KitchenBoardWorkFeed>();
    const currentRead = deferred<KitchenBoardWorkFeed>();
    mockGetWork.mockReset().mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(currentRead.promise);
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useKitchenBoardWork(enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(mockGetWork).toHaveBeenCalledTimes(1));

    rerender({ enabled: false });
    await waitFor(() => expect(result.current.state.loaded).toBe(false));
    rerender({ enabled: true });
    await waitFor(() => expect(mockGetWork).toHaveBeenCalledTimes(2));

    await act(async () => oldRead.resolve(feedWithOrders([kitchenOrder('Ready', 10)])));
    expect(result.current.state.loaded).toBe(false);
    expect(result.current.state.orders).toEqual([]);

    await act(async () => currentRead.resolve(feed));
    await waitFor(() => expect(result.current.state.loaded).toBe(true));
    expect(result.current.state.orders).toEqual([]);
  });

  it('starts a fresh request after StrictMode effect cleanup and ignores the old response', async () => {
    const firstRead = deferred<KitchenBoardWorkFeed>();
    const remountRead = deferred<KitchenBoardWorkFeed>();
    mockGetWork.mockReset().mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(remountRead.promise);
    const { result } = renderHook(() => useKitchenBoardWork(true), { reactStrictMode: true });
    await waitFor(() => expect(mockGetWork).toHaveBeenCalledTimes(2));

    await act(async () => firstRead.resolve(feedWithOrders([kitchenOrder('Ready', 10)])));
    expect(result.current.state.loaded).toBe(false);
    expect(result.current.state.orders).toEqual([]);

    await act(async () => remountRead.resolve(feed));
    await waitFor(() => expect(result.current.state.loaded).toBe(true));
    expect(result.current.state.orders).toEqual([]);
  });

  it('advances order status one step at a time with the version from the current feed', async () => {
    const forStatus = (status: string, version: number): KitchenBoardWorkFeed => ({
      ...feed,
      orders: { ...feed.orders, items: [kitchenOrder(status, version)] },
    });
    mockGetWork
      .mockResolvedValueOnce(forStatus('Confirmed', 7))
      .mockResolvedValueOnce(forStatus('Preparing', 8))
      .mockResolvedValueOnce(forStatus('Ready', 9));
    mockUpdateOrderStatus
      .mockResolvedValueOnce(orderStatusResponse('Preparing', 8))
      .mockResolvedValueOnce(orderStatusResponse('Ready', 9));

    const { result } = renderHook(() => useKitchenBoardWork(true));
    await waitFor(() => expect(result.current.state.loaded).toBe(true));

    await act(async () => result.current.setOrderStatus('order-b', 'Ready'));
    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();

    await act(async () => result.current.setOrderStatus('order-b', 'Preparing'));
    expect(mockUpdateOrderStatus).toHaveBeenNthCalledWith(1, 'order-b', {
      newStatus: 'Preparing',
      expectedVersion: 7,
    });
    await waitFor(() => expect(result.current.state.orders[0]).toMatchObject({ status: 'Preparing', version: 8 }));

    await act(async () => result.current.setOrderStatus('order-b', 'Ready'));
    expect(mockUpdateOrderStatus).toHaveBeenNthCalledWith(2, 'order-b', {
      newStatus: 'Ready',
      expectedVersion: 8,
    });
    await waitFor(() => expect(result.current.state.orders[0]).toMatchObject({ status: 'Ready', version: 9 }));
  });

  it('completes the exact correction revision and source order version from the fresh feed', async () => {
    mockCompleteWork.mockResolvedValue({
      orderId: 'order-a',
      workItemId: 'note-a',
      kind: 'AmendmentCorrection',
      accountRevision: 9,
      acknowledgedOrderVersion: 12,
      sequence: 3,
      completedAt: '2026-10-08T12:01:00Z',
      isCompleted: true,
    });
    const { result } = renderHook(() => useKitchenBoardWork(true));
    await waitFor(() => expect(result.current.state.loaded).toBe(true));

    await act(async () => result.current.completeCorrection('note-a'));

    expect(mockCompleteWork).toHaveBeenCalledWith('order-a', 'note-a', {
      kind: 'AmendmentCorrection',
      expectedOrderVersion: 12,
      expectedAccountRevision: 9,
    });
    await waitFor(() => expect(result.current.state.corrections[0].isCompleted).toBe(true));
    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
  });
});
