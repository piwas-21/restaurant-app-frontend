import { act, renderHook, waitFor } from '@testing-library/react';
import { getCashierOrders } from '@/services/cashierService';
import { useCashierOperationalCount } from './useCashierOperationalCount';

jest.mock('@/services/cashierService', () => ({ getCashierOrders: jest.fn() }));

const mockGetCashierOrders = jest.mocked(getCashierOrders);
const page = (totalCount: number) => ({
  items: [],
  totalCount,
  page: 1,
  pageSize: 1,
  totalPages: totalCount,
  hasNextPage: false,
  hasPreviousPage: false,
});

describe('useCashierOperationalCount', () => {
  beforeEach(() => mockGetCashierOrders.mockReset());

  it('uses the server total without loading the operational queue payload', async () => {
    mockGetCashierOrders.mockResolvedValue(page(17));
    const { result } = renderHook(() => useCashierOperationalCount());

    await waitFor(() => expect(result.current.count).toBe(17));
    expect(mockGetCashierOrders).toHaveBeenCalledWith({ scope: 'Operational', page: 1, pageSize: 1 });
    expect(result.current.state).toBe('ready');
  });

  it('retains the last count and marks it stale after a refresh failure', async () => {
    mockGetCashierOrders.mockResolvedValueOnce(page(4)).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useCashierOperationalCount());
    await waitFor(() => expect(result.current.count).toBe(4));

    await act(async () => {
      await result.current.refreshCount();
    });

    expect(result.current.count).toBe(4);
    expect(result.current.state).toBe('stale');
    expect(result.current.statusMessageKey).toBe('cashier.workspace.open_count_stale');
  });

  it('exposes an unavailable status without inventing an initial count', async () => {
    mockGetCashierOrders.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCashierOperationalCount());

    await waitFor(() => expect(result.current.state).toBe('unavailable'));
    expect(result.current.count).toBeUndefined();
    expect(result.current.statusMessageKey).toBe('cashier.workspace.open_count_unavailable');
  });
});
