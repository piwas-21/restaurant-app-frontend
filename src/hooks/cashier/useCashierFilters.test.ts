import { act, renderHook } from '@testing-library/react';
import { useCashierFilters } from './useCashierFilters';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useCashierFilters — operational queue', () => {
  it('uses the operational scope, resets the page for a search draft, and debounces its value', () => {
    const { result } = renderHook(() => useCashierFilters());

    expect(result.current.query).toEqual({ scope: 'Operational', page: 1, pageSize: 50 });
    act(() => result.current.setPage(2));
    act(() => result.current.setSearchQuery('  table 12  '));

    expect(result.current.query).toEqual({ scope: 'Operational', page: 1, pageSize: 50 });
    act(() => jest.advanceTimersByTime(299));
    expect(result.current.query.search).toBeUndefined();
    expect(result.current.query.page).toBe(1);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.query).toEqual({
      scope: 'Operational',
      page: 1,
      pageSize: 50,
      search: 'table 12',
    });
  });

  it('resets to the first page when the cashier changes group page size', () => {
    const { result } = renderHook(() => useCashierFilters());

    act(() => result.current.setPage(4));
    act(() => result.current.setPageSize(25));

    expect(result.current.query).toEqual({ scope: 'Operational', page: 1, pageSize: 25 });
    act(() => result.current.setPageSize(101));
    expect(result.current.query.pageSize).toBe(25);

    act(() => result.current.setPage(3));
    act(() => result.current.setStatusFilter('Ready'));
    expect(result.current.query).toMatchObject({ page: 1, status: 'Ready', pageSize: 25 });
  });

  it('commits the current draft immediately and cancels its pending debounce', () => {
    const { result } = renderHook(() => useCashierFilters());

    act(() => result.current.setSearchQuery('later-order'));
    act(() => result.current.submitSearch());
    expect(result.current.query.search).toBe('later-order');

    act(() => jest.runOnlyPendingTimers());
    expect(result.current.query.search).toBe('later-order');
  });

  it('sends a valid table number exactly and omits invalid values', () => {
    const { result } = renderHook(() => useCashierFilters());

    act(() => result.current.setTableNumberFilter(' 12 '));
    expect(result.current.query.tableNumber).toBe(12);
    act(() => result.current.setTableNumberFilter('12x'));
    expect(result.current.query.tableNumber).toBeUndefined();
    act(() => result.current.setTableNumberFilter('999999999999999999999'));
    expect(result.current.query.tableNumber).toBeUndefined();
  });

  it('adds the server-owned marketplace filter without changing the default queue', () => {
    const { result } = renderHook(() => useCashierFilters());

    expect(result.current.query.marketplaceOnly).toBeUndefined();
    act(() => result.current.setMarketplaceOnlyFilter(true));
    expect(result.current.query).toEqual({
      scope: 'Operational',
      page: 1,
      pageSize: 50,
      marketplaceOnly: true,
    });
    act(() => result.current.setMarketplaceOnlyFilter(false));
    expect(result.current.query.marketplaceOnly).toBeUndefined();
  });
});
