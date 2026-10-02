import { act, renderHook, waitFor } from '@testing-library/react';
import {
  ACTIVE_ORDER_STATUS_FILTER,
  getDineInOrders,
  getMarketplaceOperationalOrders,
  getTablesWithStatus,
} from '@/services/serverService';
import { useServerOrdersData } from './useServerOrdersData';

jest.mock('@/services/serverService', () => ({
  ACTIVE_ORDER_STATUS_FILTER: 'Pending,Confirmed,Preparing,Ready',
  getDineInOrders: jest.fn(),
  getMarketplaceOperationalOrders: jest.fn().mockResolvedValue([]),
  getTablesWithStatus: jest.fn(),
}));

const mockGetDineInOrders = getDineInOrders as jest.MockedFunction<typeof getDineInOrders>;
const mockGetMarketplaceOperationalOrders = getMarketplaceOperationalOrders as jest.MockedFunction<
  typeof getMarketplaceOperationalOrders
>;
const mockGetTablesWithStatus = getTablesWithStatus as jest.MockedFunction<typeof getTablesWithStatus>;

const emptyOrders = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 100,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('useServerOrdersData refresh state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDineInOrders.mockResolvedValue(emptyOrders);
    mockGetMarketplaceOperationalOrders.mockResolvedValue([]);
    mockGetTablesWithStatus.mockResolvedValue([]);
  });

  it('surfaces a table refresh failure while retaining the last confirmed table snapshot', async () => {
    mockGetTablesWithStatus.mockRejectedValue(new Error('table request failed'));

    const { result } = renderHook(() => useServerOrdersData());

    await waitFor(() => expect(result.current.error).toBe('Failed to load tables'));
    expect(result.current.isStale).toBe(true);
    expect(result.current.tables).toEqual([]);
  });

  it('surfaces an order refresh failure instead of leaving the panel falsely current', async () => {
    mockGetDineInOrders.mockRejectedValue(new Error('order request failed'));

    const { result } = renderHook(() => useServerOrdersData());

    await waitFor(() => expect(result.current.error).toBe('Failed to load orders'));
    expect(result.current.isStale).toBe(true);
  });

  it('combines a bounded recent page with the complete active-order safety set', async () => {
    const recent = { ...emptyOrders, items: [{ id: 'recent' }] } as Awaited<ReturnType<typeof getDineInOrders>>;
    const active = { ...emptyOrders, items: [{ id: 'active' }] } as Awaited<ReturnType<typeof getDineInOrders>>;
    mockGetDineInOrders.mockResolvedValueOnce(recent).mockResolvedValueOnce(active);

    const { result } = renderHook(() => useServerOrdersData());

    await waitFor(() => expect(result.current.orders.map((order) => order.id)).toEqual(['recent', 'active']));
    expect(mockGetDineInOrders).toHaveBeenNthCalledWith(1);
    expect(mockGetDineInOrders).toHaveBeenNthCalledWith(2, { status: ACTIVE_ORDER_STATUS_FILTER });
  });

  it('adds accepted marketplace deliveries to the existing server order feed', async () => {
    const marketplace = {
      id: 'marketplace',
      type: 'Delivery',
      status: 'Confirmed',
      externalOrder: { provider: 'uber-eats', externalDisplayId: '9116D', externalState: 'ACCEPTED' },
    };
    mockGetMarketplaceOperationalOrders.mockResolvedValue([marketplace] as Awaited<
      ReturnType<typeof getMarketplaceOperationalOrders>
    >);

    const { result } = renderHook(() => useServerOrdersData());

    await waitFor(() => expect(result.current.orders.map((order) => order.id)).toContain('marketplace'));
    expect(mockGetMarketplaceOperationalOrders).toHaveBeenCalledTimes(1);
  });

  it('merges the incremental marketplace snapshot and removes deliveries no longer operational', async () => {
    const previousMarketplace = {
      id: 'previous-marketplace',
      type: 'Delivery',
      status: 'Preparing',
      externalOrder: { provider: 'uber-eats', externalDisplayId: 'OLD-1', externalState: 'ACCEPTED' },
    };
    const currentMarketplace = {
      id: 'current-marketplace',
      type: 'Delivery',
      status: 'Ready',
      externalOrder: { provider: 'uber-eats', externalDisplayId: 'NEW-2', externalState: 'ACCEPTED' },
    };
    mockGetMarketplaceOperationalOrders.mockResolvedValueOnce([previousMarketplace] as Awaited<
      ReturnType<typeof getMarketplaceOperationalOrders>
    >);

    let poll: (() => void) | undefined;
    const originalSetInterval = global.setInterval;
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((handler, delay, ...args) => {
      if (delay === 5000 && typeof handler === 'function') {
        poll = handler as () => void;
        return 1 as unknown as NodeJS.Timeout;
      }
      return originalSetInterval(handler, delay, ...args);
    });

    const { result, unmount } = renderHook(() => useServerOrdersData());

    try {
      await waitFor(() => expect(result.current.orders.map((order) => order.id)).toContain('previous-marketplace'));
      mockGetDineInOrders.mockResolvedValueOnce({ ...emptyOrders, items: [{ id: 'updated-dine-in' }] } as Awaited<
        ReturnType<typeof getDineInOrders>
      >);
      mockGetMarketplaceOperationalOrders.mockResolvedValueOnce([currentMarketplace] as Awaited<
        ReturnType<typeof getMarketplaceOperationalOrders>
      >);

      await new Promise((resolve) => setTimeout(resolve, 125));
      expect(poll).toBeDefined();
      await act(async () => {
        poll?.();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.orders.map((order) => order.id)).toEqual(['current-marketplace', 'updated-dine-in']);
      });
      expect(mockGetDineInOrders).toHaveBeenLastCalledWith({ modifiedSince: expect.any(Date) });
    } finally {
      unmount();
      intervalSpy.mockRestore();
    }
  });

  it('ignores an older polling response after a mutation-triggered full refresh', async () => {
    const staleOrder = {
      id: 'stale-marketplace',
      type: 'Delivery',
      status: 'Confirmed',
      externalOrder: { provider: 'uber-eats', externalDisplayId: 'OLD-1', externalState: 'ACCEPTED' },
    };
    const freshOrder = {
      id: 'fresh-marketplace',
      type: 'Delivery',
      status: 'Preparing',
      externalOrder: { provider: 'uber-eats', externalDisplayId: 'NEW-2', externalState: 'ACCEPTED' },
    };
    const older = deferred<Awaited<ReturnType<typeof getMarketplaceOperationalOrders>>>();
    const newer = deferred<Awaited<ReturnType<typeof getMarketplaceOperationalOrders>>>();
    mockGetMarketplaceOperationalOrders.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const { result } = renderHook(() => useServerOrdersData());
    await waitFor(() => expect(mockGetMarketplaceOperationalOrders).toHaveBeenCalledTimes(1));

    let mutationRefresh!: Promise<void>;
    act(() => {
      mutationRefresh = result.current.refreshOrders();
    });
    await waitFor(() => expect(mockGetMarketplaceOperationalOrders).toHaveBeenCalledTimes(2));

    await act(async () => {
      newer.resolve([freshOrder] as Awaited<ReturnType<typeof getMarketplaceOperationalOrders>>);
      await mutationRefresh;
    });
    expect(result.current.orders.map((order) => order.id)).toContain('fresh-marketplace');

    await act(async () => {
      older.resolve([staleOrder] as Awaited<ReturnType<typeof getMarketplaceOperationalOrders>>);
      await Promise.resolve();
    });
    expect(result.current.orders.map((order) => order.id)).toContain('fresh-marketplace');
    expect(result.current.orders.map((order) => order.id)).not.toContain('stale-marketplace');
  });
});
