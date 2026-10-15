import { act, renderHook, waitFor } from '@testing-library/react';
import { dismissPriorDayOrderReview, getCashierDailyArchive, getCashierOrders } from '@/services/cashierService';
import type { CashierDailyArchiveDto, OrderDto, PagedResult } from '@/types/order';
import { useCashierHistoryOrders } from './useCashierHistoryOrders';

jest.mock('@/services/cashierService', () => ({
  getCashierOrders: jest.fn(),
  getCashierDailyArchive: jest.fn(),
  dismissPriorDayOrderReview: jest.fn(),
}));
const mockGetCashierOrders = jest.mocked(getCashierOrders);
const mockGetCashierDailyArchive = jest.mocked(getCashierDailyArchive);
const mockDismissPriorDayOrderReview = jest.mocked(dismissPriorDayOrderReview);

const order = { id: 'one', orderNumber: '1042' } as unknown as OrderDto;
const page = (items: OrderDto[]): PagedResult<OrderDto> => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 50,
  totalPages: items.length ? 1 : 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

beforeEach(() => {
  mockGetCashierOrders.mockReset();
  mockGetCashierDailyArchive.mockReset();
  mockDismissPriorDayOrderReview.mockReset();
});

describe('useCashierHistoryOrders', () => {
  it('retains the last snapshot and marks it stale after refresh failure', async () => {
    mockGetCashierOrders.mockResolvedValueOnce(page([order])).mockRejectedValueOnce(new Error('offline'));
    const query = { scope: 'All' as const, page: 1, pageSize: 50 };
    const { result } = renderHook(() => useCashierHistoryOrders(query, { enabled: true, blockedState: 'unavailable' }));

    await waitFor(() => expect(result.current.queueState).toBe('ready'));
    await act(async () => {
      await result.current.refreshOrders();
    });

    expect(result.current.orders).toEqual([order]);
    expect(result.current.queueState).toBe('stale');
  });

  it('does not refetch when only an equivalent query object is recreated', async () => {
    mockGetCashierOrders.mockResolvedValue(page([order]));
    const { result, rerender } = renderHook(
      ({ tick }) => {
        void tick;
        return useCashierHistoryOrders(
          { scope: 'All', page: 1, pageSize: 50 },
          { enabled: true, blockedState: 'unavailable' },
        );
      },
      { initialProps: { tick: 0 } },
    );

    await waitFor(() => expect(result.current.queueState).toBe('ready'));
    rerender({ tick: 1 });
    expect(mockGetCashierOrders).toHaveBeenCalledTimes(1);
  });

  it('uses the server-owned current-day archive and retains the independent unresolved page', async () => {
    const prior = { ...order, id: 'prior-day', dailyOrderNumber: 8 };
    const archive: CashierDailyArchiveDto = {
      businessDate: '2026-10-15',
      orders: page([order]),
      priorDayUnresolvedOrders: page([prior]),
    };
    mockGetCashierDailyArchive.mockResolvedValue(archive);
    const query = {
      scope: 'All' as const,
      page: 1,
      pageSize: 50,
      archiveBusinessDate: '2026-10-15',
      status: 'Completed',
    };
    const { result } = renderHook(() => useCashierHistoryOrders(query, { enabled: true, blockedState: 'unavailable' }));

    await waitFor(() => expect(result.current.queueState).toBe('ready'));
    expect(mockGetCashierDailyArchive).toHaveBeenCalledWith({
      businessDate: '2026-10-15',
      search: undefined,
      status: 'Completed',
      paymentStatus: undefined,
      orderType: undefined,
      page: 1,
      pageSize: 50,
      priorDayUnresolvedPage: 1,
      priorDayUnresolvedPageSize: 50,
    });
    expect(result.current.orders).toEqual([order]);
    expect(result.current.priorDayUnresolvedOrders.items).toEqual([prior]);
    expect(mockGetCashierOrders).not.toHaveBeenCalled();
  });

  it('persists a prior-day dismissal and immediately removes the reminder from the workspace', async () => {
    const prior = { ...order, id: 'prior-day' };
    const archive: CashierDailyArchiveDto = {
      businessDate: '2026-10-15',
      orders: page([order]),
      priorDayUnresolvedOrders: page([prior]),
    };
    mockGetCashierDailyArchive.mockResolvedValueOnce(archive).mockResolvedValueOnce({
      businessDate: '2026-10-15',
      orders: page([order]),
      priorDayUnresolvedOrders: page([]),
    });
    mockDismissPriorDayOrderReview.mockResolvedValue(undefined);
    const query = { scope: 'All' as const, page: 1, pageSize: 50, archiveBusinessDate: '2026-10-15' };
    const { result } = renderHook(() => useCashierHistoryOrders(query, { enabled: true, blockedState: 'unavailable' }));

    await waitFor(() => expect(result.current.priorDayUnresolvedOrders.items).toEqual([prior]));
    await act(async () => result.current.dismissPriorDayOrder(prior.id));

    expect(mockDismissPriorDayOrderReview).toHaveBeenCalledWith(prior.id);
    expect(mockGetCashierDailyArchive).toHaveBeenCalledTimes(2);
    expect(result.current.priorDayUnresolvedOrders.items).toEqual([]);
    expect(result.current.priorDayUnresolvedOrders.page).toBe(1);
  });

  it('loads the next prior-day unresolved page and merges orders without duplicate IDs', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      ...order,
      id: `prior-${index}`,
      dailyOrderNumber: index + 1,
    })) as OrderDto[];
    const secondPage = [
      { ...order, id: 'prior-49', dailyOrderNumber: 50 },
      { ...order, id: 'prior-50' },
    ] as OrderDto[];
    mockGetCashierDailyArchive
      .mockResolvedValueOnce({
        businessDate: '2026-10-15',
        orders: page([]),
        priorDayUnresolvedOrders: { ...page(firstPage), totalCount: 51, hasNextPage: true, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        businessDate: '2026-10-15',
        orders: page([]),
        priorDayUnresolvedOrders: {
          ...page(secondPage),
          page: 2,
          totalCount: 51,
          hasNextPage: false,
          hasPreviousPage: true,
          totalPages: 2,
        },
      });
    const query = { scope: 'All' as const, page: 1, pageSize: 50, archiveBusinessDate: '2026-10-15' };
    const { result } = renderHook(() => useCashierHistoryOrders(query, { enabled: true, blockedState: 'unavailable' }));

    await waitFor(() => expect(result.current.priorDayUnresolvedOrders.items).toHaveLength(50));
    await act(async () => result.current.loadMorePriorDayOrders());

    expect(mockGetCashierDailyArchive).toHaveBeenLastCalledWith({
      businessDate: '2026-10-15',
      search: undefined,
      status: undefined,
      paymentStatus: undefined,
      orderType: undefined,
      page: 1,
      pageSize: 50,
      priorDayUnresolvedPage: 2,
      priorDayUnresolvedPageSize: 50,
    });
    expect(result.current.priorDayUnresolvedOrders.items).toHaveLength(51);
    expect(result.current.hasMorePriorDayOrders).toBe(false);
  });

  it('refetches page one after dismissal so a shifted row is not skipped by the next offset page', async () => {
    const makeOrders = (start: number, end: number) =>
      Array.from({ length: end - start + 1 }, (_, offset) => ({
        ...order,
        id: `prior-${start + offset}`,
      })) as OrderDto[];
    const archivePage = (items: OrderDto[], requestedPage: number, totalCount: number): CashierDailyArchiveDto => ({
      businessDate: '2026-10-15',
      orders: page([]),
      priorDayUnresolvedOrders: {
        ...page(items),
        page: requestedPage,
        totalCount,
        totalPages: Math.ceil(totalCount / 50),
        hasNextPage: requestedPage * 50 < totalCount,
        hasPreviousPage: requestedPage > 1,
      },
    });
    mockGetCashierDailyArchive
      .mockResolvedValueOnce(archivePage(makeOrders(0, 49), 1, 101))
      .mockResolvedValueOnce(archivePage(makeOrders(50, 99), 2, 101))
      .mockResolvedValueOnce(archivePage(makeOrders(1, 50), 1, 100))
      .mockResolvedValueOnce(archivePage(makeOrders(51, 100), 2, 100));
    mockDismissPriorDayOrderReview.mockResolvedValue(undefined);
    const query = { scope: 'All' as const, page: 1, pageSize: 50, archiveBusinessDate: '2026-10-15' };
    const { result } = renderHook(() => useCashierHistoryOrders(query, { enabled: true, blockedState: 'unavailable' }));

    await waitFor(() => expect(result.current.priorDayUnresolvedOrders.items).toHaveLength(50));
    await act(async () => result.current.loadMorePriorDayOrders());
    expect(result.current.priorDayUnresolvedOrders.items).toHaveLength(100);

    await act(async () => result.current.dismissPriorDayOrder('prior-0'));
    expect(result.current.priorDayUnresolvedOrders.page).toBe(1);
    expect(result.current.priorDayUnresolvedOrders.items[49].id).toBe('prior-50');

    await act(async () => result.current.loadMorePriorDayOrders());
    const loadedIds = new Set(result.current.priorDayUnresolvedOrders.items.map((candidate) => candidate.id));
    expect(loadedIds.size).toBe(100);
    expect(loadedIds.has('prior-50')).toBe(true);
    expect(loadedIds.has('prior-100')).toBe(true);
    expect(loadedIds.has('prior-0')).toBe(false);
    expect(mockGetCashierDailyArchive).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ priorDayUnresolvedPage: 2 }),
    );
  });
});
