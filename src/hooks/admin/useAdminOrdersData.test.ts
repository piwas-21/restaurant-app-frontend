import { act, renderHook, waitFor } from '@testing-library/react';
import { getOrders } from '@/services/orderService';
import { useAdminOrdersData } from './useAdminOrdersData';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import type { OrderDto } from '@/types/order';

const mockTranslate = (key: string) => key;
const mockEnqueueSnackbar = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }) }));
jest.mock('@/services/orderService', () => ({ getOrders: jest.fn() }));
jest.mock('@/hooks/useOrderFilterPreferences', () => ({
  useOrderFilterPreferences: () => ({
    preferences: {
      selectedStatus: 'All',
      selectedPaymentStatus: 'All',
      selectedOrderType: 'All',
      showFocusOnly: false,
      sortBy: 'date',
      sortOrder: 'desc',
    },
    isLoaded: true,
    savePreferences: jest.fn(),
    clearPreferences: jest.fn(),
  }),
}));

const mockedGetOrders = jest.mocked(getOrders);

function marketplaceRows(first: number, last: number): OrderDto[] {
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const order = marketplaceOrder();
    order.id = `market-order-${first + index}`;
    order.orderNumber = `${first + index}`;
    order.externalOrder!.externalDisplayId = `EXT-${first + index}`;
    return order;
  });
}

function paged(items: OrderDto[], page: number) {
  return {
    items,
    totalCount: 25,
    page,
    pageSize: 20,
    totalPages: 2,
    hasNextPage: page === 1,
    hasPreviousPage: page === 2,
  };
}

afterEach(() => jest.clearAllMocks());

it('requests marketplace pages and reports the server total beyond the first ten rows', async () => {
  mockedGetOrders.mockImplementation(async (filters) =>
    paged(filters?.page === 2 ? marketplaceRows(21, 25) : marketplaceRows(1, 20), filters?.page ?? 1),
  );

  const { result } = renderHook(() => useAdminOrdersData({ isReady: true }));
  await waitFor(() => expect(result.current.totalCount).toBe(25));
  await act(async () => result.current.setSelectedMarketplaceOnly(true));
  await waitFor(() =>
    expect(mockedGetOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ marketplaceOnly: true, page: 1, pageSize: 20 }),
    ),
  );

  expect(result.current.totalPages).toBe(2);
  expect(result.current.orders).toHaveLength(20);

  await act(async () => result.current.setCurrentPage(2));
  await waitFor(() => expect(result.current.orders[0]?.externalOrder?.externalDisplayId).toBe('EXT-21'));
  expect(result.current.totalCount).toBe(25);
  expect(result.current.totalPages).toBe(2);
  expect(mockedGetOrders).toHaveBeenLastCalledWith(
    expect.objectContaining({ marketplaceOnly: true, page: 2, pageSize: 20 }),
  );
});

it('clamps an emptied last marketplace page after its only row is removed', async () => {
  let sourceRows = marketplaceRows(1, 21);
  mockedGetOrders.mockImplementation(async (filters) => {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const totalPages = Math.ceil(sourceRows.length / pageSize);
    return {
      items: sourceRows.slice(start, start + pageSize),
      totalCount: sourceRows.length,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  });

  const { result } = renderHook(() => useAdminOrdersData({ isReady: true }));
  await act(async () => result.current.setSelectedMarketplaceOnly(true));
  await waitFor(() => expect(result.current.totalCount).toBe(21));
  await act(async () => result.current.setCurrentPage(2));
  await waitFor(() => expect(result.current.orders[0]?.id).toBe('market-order-21'));

  sourceRows = sourceRows.slice(0, 20);
  await act(async () => {
    await result.current.fetchOrders();
  });

  await waitFor(() => {
    expect(result.current.currentPage).toBe(1);
    expect(result.current.orders).toHaveLength(20);
  });
  expect(result.current.totalCount).toBe(20);
  expect(result.current.totalPages).toBe(1);
});
