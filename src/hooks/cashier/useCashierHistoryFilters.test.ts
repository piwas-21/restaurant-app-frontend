import { act, renderHook, waitFor } from '@testing-library/react';
import { getCashierTenantContext } from '@/services/cashierService';
import { useCashierHistoryFilters } from './useCashierHistoryFilters';

const mockSearchParams = new URLSearchParams();
const mockReplace = jest.fn();

jest.mock('@/services/cashierService', () => ({ getCashierTenantContext: jest.fn() }));
jest.mock('next/navigation', () => ({
  usePathname: () => '/cashier/history',
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

const mockGetCashierTenantContext = jest.mocked(getCashierTenantContext);

beforeEach(() => {
  mockSearchParams.delete('range');
  mockSearchParams.delete('from');
  mockSearchParams.delete('to');
  mockReplace.mockReset();
  mockGetCashierTenantContext.mockReset();
});

describe('useCashierHistoryFilters tenant context lifecycle', () => {
  it('retains the last usable day and timezone after a refresh failure', async () => {
    mockGetCashierTenantContext
      .mockResolvedValueOnce({ date: '2026-03-29', timeZone: 'Europe/Zurich' })
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useCashierHistoryFilters());

    await waitFor(() => expect(result.current.tenantDay).toBe('2026-03-29'));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(result.current.tenantDayError).toBe(true));

    expect(result.current.tenantDay).toBe('2026-03-29');
    expect(result.current.tenantTimeZone).toBe('Europe/Zurich');
  });

  it('does not re-ask the tenant day on visibility while a custom range is selected', async () => {
    mockSearchParams.set('range', 'custom');
    mockSearchParams.set('from', '2026-03-01');
    mockSearchParams.set('to', '2026-03-03');
    mockGetCashierTenantContext.mockResolvedValue({ date: '2026-03-29', timeZone: 'Europe/Zurich' });
    renderHook(() => useCashierHistoryFilters());

    await waitFor(() => expect(mockGetCashierTenantContext).toHaveBeenCalledTimes(1));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(mockGetCashierTenantContext).toHaveBeenCalledTimes(1);
  });
});
