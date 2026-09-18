import { act, renderHook, waitFor } from '@testing-library/react';
import { getCashierOrders } from '@/services/cashierService';
import type { OrderDto, PagedResult } from '@/types/order';
import { useCashierHistoryOrders } from './useCashierHistoryOrders';

jest.mock('@/services/cashierService', () => ({ getCashierOrders: jest.fn() }));
const mockGetCashierOrders = jest.mocked(getCashierOrders);

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

beforeEach(() => mockGetCashierOrders.mockReset());

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
});
