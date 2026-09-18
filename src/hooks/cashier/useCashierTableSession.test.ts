import { act, renderHook, waitFor } from '@testing-library/react';
import { PaymentMethod, type TableServiceSessionDto } from '@/types/order';
import { ApiError } from '@/utils/apiClient';
import {
  addTableServiceSessionPayment,
  closeTableServiceSession,
  getTableServiceSession,
  lookupTableServiceSessionPaymentOperation,
} from '@/services/tableServiceSessionService';
import { persistPendingTableClose, persistPendingTablePayment } from '@/lib/cashierTablePending';
import { useCashierTableSession } from './useCashierTableSession';

jest.mock('@/services/tableServiceSessionService');

const mockedGet = jest.mocked(getTableServiceSession);
const mockedAdd = jest.mocked(addTableServiceSessionPayment);
const mockedClose = jest.mocked(closeTableServiceSession);
const mockedLookup = jest.mocked(lookupTableServiceSessionPaymentOperation);
const session = (over: Partial<TableServiceSessionDto> = {}): TableServiceSessionDto => ({
  serviceSessionId: 'session-1',
  tableNumber: 7,
  currency: 'EUR',
  status: 'Open',
  version: 4,
  openedAt: '2026-09-12T18:00:00Z',
  closedAt: null,
  roundCount: 1,
  ageMinutes: 10,
  outstanding: 20,
  bill: {
    tableNumber: 7,
    generatedAt: '2026-09-12T18:00:00Z',
    serviceSessionId: 'session-1',
    serviceSessionVersion: 4,
    currency: 'EUR',
    orders: [],
    orderCount: 0,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remaining: 20,
  },
  ...over,
});
const payment = {
  operationId: '11111111-1111-4111-8111-111111111111',
  expectedVersion: 4,
  paymentMethod: PaymentMethod.Cash,
  amount: 20,
  currency: 'EUR',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockedGet.mockResolvedValue(session());
});

describe('useCashierTableSession', () => {
  it('restores an uncertain payment but never silently posts it after reload', async () => {
    persistPendingTablePayment('session-1', payment);
    const { result } = renderHook(() => useCashierTableSession('session-1'));

    await waitFor(() => expect(result.current.session).not.toBeNull());
    expect(result.current.pendingOperation).toEqual(expect.objectContaining({ status: 'Unknown', kind: 'payment' }));
    expect(mockedAdd).not.toHaveBeenCalled();
  });

  it('pins a payment to the observed version and clears persistence only on success', async () => {
    mockedAdd.mockResolvedValue(session({ version: 5, outstanding: 0 }));
    const { result } = renderHook(() => useCashierTableSession('session-1'));
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(async () => {
      await result.current.submitPayment(payment);
    });
    expect(mockedAdd).toHaveBeenCalledWith('session-1', payment);
    expect(result.current.pendingOperation).toBeNull();
    expect(window.sessionStorage.getItem('cashier.pending-table-operation')).toBeNull();
  });

  it('keeps an unknown close persisted without reposting an unverified operation', async () => {
    mockedClose.mockRejectedValueOnce(new ApiError(503, ''));
    const { result } = renderHook(() => useCashierTableSession('session-1'));
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(async () => {
      await expect(result.current.closeSession()).rejects.toBeInstanceOf(ApiError);
    });
    expect(result.current.pendingOperation).toEqual(expect.objectContaining({ kind: 'close', status: 'Unknown' }));
    expect(mockedClose).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('cashier.pending-table-operation')).toContain('close');
  });

  it('reconciles an unknown payment through lookup without posting it again', async () => {
    const committed = session({ version: 5, outstanding: 0 });
    mockedAdd.mockRejectedValueOnce(new ApiError(503, ''));
    mockedLookup.mockResolvedValueOnce({
      operationId: payment.operationId,
      status: 'Committed',
      session: committed,
      payments: [],
    });
    const { result } = renderHook(() => useCashierTableSession('session-1'));
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(async () => {
      await expect(result.current.submitPayment(payment)).rejects.toBeInstanceOf(ApiError);
    });
    expect(result.current.pendingOperation).toEqual(expect.objectContaining({ status: 'Unknown' }));

    await act(async () => {
      await result.current.reconcilePendingOperation();
    });
    expect(mockedAdd).toHaveBeenCalledTimes(1);
    expect(mockedLookup).toHaveBeenCalledWith('session-1', payment.operationId);
    expect(result.current.pendingOperation).toBeNull();
    expect(result.current.session).toEqual(committed);
  });

  it('keeps an unknown payment blocked when lookup still has no committed result', async () => {
    mockedAdd.mockRejectedValueOnce(new ApiError(503, ''));
    mockedLookup.mockResolvedValueOnce({
      operationId: payment.operationId,
      status: 'Unknown',
      session: null,
      payments: [],
    });
    const { result } = renderHook(() => useCashierTableSession('session-1'));
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(async () => {
      await expect(result.current.submitPayment(payment)).rejects.toBeInstanceOf(ApiError);
    });
    await waitFor(() =>
      expect(result.current.pendingOperation).toEqual(expect.objectContaining({ status: 'Unknown' })),
    );
    await act(async () => {
      await result.current.reconcilePendingOperation();
    });
    expect(mockedAdd).toHaveBeenCalledTimes(1);
    expect(mockedLookup).toHaveBeenCalledTimes(1);
    expect(result.current.pendingOperation).toEqual(expect.objectContaining({ status: 'Unknown' }));
  });

  it('rejects a duplicate payment submit while the first write is in flight', async () => {
    const first = deferred<TableServiceSessionDto>();
    mockedAdd.mockReturnValueOnce(first.promise);
    const { result } = renderHook(() => useCashierTableSession('session-1'));
    await waitFor(() => expect(result.current.session).not.toBeNull());

    let firstPromise!: Promise<TableServiceSessionDto>;
    act(() => {
      firstPromise = result.current.submitPayment(payment);
    });
    await waitFor(() => expect(result.current.isMutating).toBe(true));

    await expect(result.current.submitPayment(payment)).rejects.toThrow('cashier.tables.operation_pending');
    expect(mockedAdd).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(session({ version: 5, outstanding: 0 }));
      await firstPromise;
    });
  });

  it('does not let a refresh started before payment overwrite the mutation result', async () => {
    const stale = deferred<TableServiceSessionDto>();
    mockedGet.mockResolvedValueOnce(session());
    const { result } = renderHook(() => useCashierTableSession('session-1'));
    await waitFor(() => expect(result.current.session).not.toBeNull());

    mockedGet.mockReturnValueOnce(stale.promise);
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });
    mockedAdd.mockResolvedValueOnce(session({ version: 5, outstanding: 0 }));
    await act(async () => {
      await result.current.submitPayment(payment);
    });

    stale.resolve(session({ version: 99, outstanding: 99 }));
    await act(async () => {
      await refreshPromise;
    });
    expect(result.current.session).toEqual(expect.objectContaining({ version: 5, outstanding: 0 }));
  });
});

it('resolves an unknown close as committed through a guarded re-read and clears the lock', async () => {
  persistPendingTableClose('session-1', 4);
  const closed = session({ status: 'Closed', closedAt: '2026-09-12T20:00:00Z' });
  mockedGet.mockResolvedValue(closed);
  const { result } = renderHook(() => useCashierTableSession('session-1'));
  await waitFor(() =>
    expect(result.current.pendingOperation).toEqual(expect.objectContaining({ kind: 'close', status: 'Unknown' })),
  );

  await act(async () => {
    await result.current.reconcilePendingOperation();
  });
  expect(mockedClose).not.toHaveBeenCalled();
  expect(result.current.pendingOperation).toBeNull();
  expect(result.current.session).toEqual(closed);
  expect(result.current.error).toBeNull();
  expect(window.sessionStorage.getItem('cashier.pending-table-operation')).toBeNull();
});

it('resolves an unknown close as still-open so a retry stays a deliberate decision', async () => {
  persistPendingTableClose('session-1', 4);
  mockedGet.mockResolvedValue(session());
  const { result } = renderHook(() => useCashierTableSession('session-1'));
  await waitFor(() =>
    expect(result.current.pendingOperation).toEqual(expect.objectContaining({ kind: 'close', status: 'Unknown' })),
  );

  await act(async () => {
    await result.current.reconcilePendingOperation();
  });
  expect(mockedClose).not.toHaveBeenCalled();
  expect(result.current.pendingOperation).toBeNull();
  expect(result.current.error).toBe('cashier.tables.close_not_recorded');
  expect(result.current.session?.status).toBe('Open');
});
