import { act, renderHook } from '@testing-library/react';
import { useTableServiceSession, type TableServiceSessionState } from '@/hooks/table-service/useTableServiceSession';
import { requestTableServicePaymentHandoff } from '@/services/tableServiceSessionService';
import type { TableServiceSessionDto } from '@/types/order';
import { useServerTableBillActions } from './useServerTableBillActions';

jest.mock('@/hooks/table-service/useTableServiceSession');
jest.mock('@/services/tableServiceSessionService');

const mockedSharedHook = jest.mocked(useTableServiceSession);
const mockedRequestHandoff = jest.mocked(requestTableServicePaymentHandoff);
const refresh = jest.fn(async () => undefined);

const session = (serviceSessionId: string, version: number): TableServiceSessionDto => ({
  serviceSessionId,
  tableNumber: 1,
  currency: 'EUR',
  status: 'Open',
  version,
  openedAt: '2026-09-22T10:00:00Z',
  roundCount: 1,
  ageMinutes: 1,
  outstanding: 10,
  bill: {
    serviceSessionId,
    serviceSessionVersion: version,
    tableNumber: 1,
    currency: 'EUR',
    generatedAt: '2026-09-22T10:01:00Z',
    orders: [],
    orderCount: 0,
    subTotal: 10,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 10,
    totalPaid: 0,
    remaining: 10,
  },
});

function sharedState(current: TableServiceSessionDto | null): TableServiceSessionState {
  return {
    session: current,
    isLoading: false,
    isMutating: false,
    isStale: false,
    error: null,
    pendingOperation: null,
    refresh,
    submitPayment: jest.fn(),
    closeSession: jest.fn(),
    reconcilePendingOperation: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSharedHook.mockReturnValue(sharedState(null));
});

describe('useServerTableBillActions', () => {
  it('polls the authoritative session so cashier resolution reaches the server view', () => {
    jest.useFakeTimers();
    renderHook(() => useServerTableBillActions(session('session-1', 1), jest.fn()));

    act(() => jest.advanceTimersByTime(15_000));

    expect(refresh).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('never carries a higher-version snapshot into a different visit', () => {
    mockedSharedHook.mockReturnValue(sharedState(session('session-old', 20)));
    const { result, rerender } = renderHook(({ current }) => useServerTableBillActions(current, jest.fn()), {
      initialProps: { current: session('session-old', 20) },
    });
    expect(result.current.session?.serviceSessionId).toBe('session-old');

    rerender({ current: session('session-new', 1) });

    expect(result.current.session?.serviceSessionId).toBe('session-new');
    expect(result.current.session?.version).toBe(1);
  });

  it('uses a translated fallback key when a handoff failure has no message', async () => {
    mockedSharedHook.mockReturnValue(sharedState(session('session-1', 1)));
    mockedRequestHandoff.mockRejectedValueOnce(null);
    const { result } = renderHook(() => useServerTableBillActions(session('session-1', 1), jest.fn()));

    await act(async () => {
      try {
        await result.current.requestHandoff();
      } catch {
        // The hook exposes the failure and preserves the rejection for its caller.
      }
    });

    expect(result.current.error).toBe('server.bill.operation_failed');
  });
});
