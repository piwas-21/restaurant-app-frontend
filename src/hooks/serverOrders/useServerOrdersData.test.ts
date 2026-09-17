import { renderHook, waitFor } from '@testing-library/react';
import { ACTIVE_ORDER_STATUS_FILTER, getDineInOrders, getTablesWithStatus } from '@/services/serverService';
import { useServerOrdersData } from './useServerOrdersData';

jest.mock('@/services/serverService', () => ({
  ACTIVE_ORDER_STATUS_FILTER: 'Pending,Confirmed,Preparing,Ready',
  getDineInOrders: jest.fn(),
  getTablesWithStatus: jest.fn(),
}));

const mockGetDineInOrders = getDineInOrders as jest.MockedFunction<typeof getDineInOrders>;
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

describe('useServerOrdersData refresh state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDineInOrders.mockResolvedValue(emptyOrders);
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
});
