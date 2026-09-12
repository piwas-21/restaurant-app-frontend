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
  it('uses the operational scope and does not change the request while text is only a draft', () => {
    const { result } = renderHook(() => useCashierFilters());

    expect(result.current.query).toEqual({ scope: 'Operational', page: 1, pageSize: 50 });
    act(() => result.current.setPage(2));
    act(() => result.current.setSearchQuery('  table 12  '));

    expect(result.current.query).toEqual({ scope: 'Operational', page: 2, pageSize: 50 });
    act(() => jest.advanceTimersByTime(299));
    expect(result.current.query.search).toBeUndefined();

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.query).toEqual({
      scope: 'Operational',
      page: 1,
      pageSize: 50,
      search: 'table 12',
    });
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
});
