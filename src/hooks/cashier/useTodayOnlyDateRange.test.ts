import '@testing-library/jest-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTodayOnlyDateRange } from './useTodayOnlyDateRange';
import { getCashierTenantDay } from '@/services/cashierService';

// #545 (C09): the cashier's "today" is the RESTAURANT's calendar day, asked of the venue — the
// device zone is never consulted, so there is no local-midnight Date math left to pin. The
// window instants themselves are computed server-side from this day string.
jest.mock('@/services/cashierService', () => ({ getCashierTenantDay: jest.fn() }));

const mockGetCashierTenantDay = getCashierTenantDay as jest.Mock;

beforeEach(() => {
  // The hook persists the toggle in localStorage; a previous test's "false" must not leak.
  window.localStorage.removeItem('cashier:todayOnly');
  mockGetCashierTenantDay.mockReset();
});

describe('useTodayOnlyDateRange — tenant-day window', () => {
  it('hands the venue day to the queue when today-only is on', async () => {
    mockGetCashierTenantDay.mockResolvedValue('2026-03-08');
    const { result } = renderHook(() => useTodayOnlyDateRange());

    await waitFor(() => expect(result.current.tenantDay).toBe('2026-03-08'));
    expect(result.current.todayOnly).toBe(true);
  });

  it('sends no window while the venue clock is unavailable', async () => {
    mockGetCashierTenantDay.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayOnlyDateRange());

    await waitFor(() => expect(mockGetCashierTenantDay).toHaveBeenCalledTimes(1));
    expect(result.current.tenantDay).toBeUndefined();
  });

  it('sends no window when today-only is off', async () => {
    mockGetCashierTenantDay.mockResolvedValue('2026-03-08');
    const { result } = renderHook(() => useTodayOnlyDateRange());
    await waitFor(() => expect(result.current.tenantDay).toBe('2026-03-08'));

    act(() => result.current.setTodayOnly(false));
    expect(result.current.tenantDay).toBeUndefined();
  });

  it('re-asks the venue clock after visibility resumes without any device-zone involvement', async () => {
    mockGetCashierTenantDay.mockResolvedValueOnce('2026-03-07').mockResolvedValueOnce('2026-03-08');
    const { result } = renderHook(() => useTodayOnlyDateRange());
    await waitFor(() => expect(result.current.tenantDay).toBe('2026-03-07'));

    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(result.current.tenantDay).toBe('2026-03-08'));
  });
});
