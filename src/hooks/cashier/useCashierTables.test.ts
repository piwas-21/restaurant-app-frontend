import { act, renderHook, waitFor } from '@testing-library/react';
import type { TableDto } from '@/types/reservation';
import type { TableServiceSessionDto } from '@/types/order';
import { getCashierTables } from '@/services/server/tables';
import {
  getActiveTableServiceSessions,
  openTableServiceSession,
  repairLegacyTableServiceSession,
} from '@/services/tableServiceSessionService';
import { useCashierTables } from './useCashierTables';

jest.mock('@/services/server/tables');
jest.mock('@/services/tableServiceSessionService');

const mockedTables = jest.mocked(getCashierTables);
const mockedSessions = jest.mocked(getActiveTableServiceSessions);
const mockedOpen = jest.mocked(openTableServiceSession);
const mockedRepair = jest.mocked(repairLegacyTableServiceSession);
const session = (id: string, tableNumber: number): TableServiceSessionDto => ({
  serviceSessionId: id,
  tableNumber,
  currency: 'EUR',
  status: 'Open',
  version: 1,
  openedAt: '2026-09-12T18:00:00Z',
  closedAt: null,
  roundCount: 1,
  ageMinutes: 5,
  outstanding: 10,
  bill: {
    tableNumber,
    generatedAt: '2026-09-12T18:00:00Z',
    serviceSessionId: id,
    serviceSessionVersion: 1,
    currency: 'EUR',
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedTables.mockResolvedValue([
    { id: 't1', tableNumber: '01', maxGuests: 2, isActive: true, isOutdoor: false, positionX: 1, positionY: 1 },
    {
      id: 't2',
      tableNumber: '2',
      maxGuests: 4,
      isActive: true,
      isOutdoor: false,
      positionX: 2,
      positionY: 1,
      isOccupied: true,
      activeOrderCount: 1,
    },
    { id: 't3', tableNumber: '3', maxGuests: 4, isActive: false, isOutdoor: false, positionX: 3, positionY: 1 },
  ]);
  mockedSessions.mockResolvedValue([session('session-4', 4)]);
});

describe('useCashierTables', () => {
  it('keeps legacy occupancy blocked and retains a session with no physical table row', async () => {
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    expect(result.current.entries.map((entry) => [entry.table.tableNumber, entry.status])).toEqual([
      ['01', 'available'],
      ['2', 'legacy'],
      ['3', 'closed'],
      ['4', 'occupied'],
    ]);
    expect(result.current.entries.find((entry) => entry.table.tableNumber === '2')?.table.activeOrderCount).toBe(1);
    await expect(result.current.openSession('2')).rejects.toThrow('cashier.tables.open_failed');
    expect(mockedOpen).not.toHaveBeenCalled();
  });

  it('repairs a legacy-only table by stable identity and adopts the returned visit', async () => {
    const repaired = session('repaired-session', 2);
    mockedRepair.mockResolvedValue(repaired);
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    await act(async () => {
      await result.current.repairLegacyOrders('t2');
    });

    expect(mockedRepair).toHaveBeenCalledWith('t2');
    expect(result.current.entries.find((entry) => entry.table.id === 't2')).toMatchObject({
      status: 'occupied',
      session: repaired,
    });
    expect(result.current.repairSuccess).toBe(true);
  });

  it('keeps a localized refusal visible when the repair is rejected', async () => {
    mockedRepair.mockRejectedValue(new Error('server refusal'));
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    await act(async () => {
      await expect(result.current.repairLegacyOrders('t2')).rejects.toThrow('server refusal');
    });

    expect(result.current.error).toBe('cashier.tables.legacy_repair_failed');
    expect(result.current.repairSuccess).toBe(false);
    expect(result.current.isMutating).toBe(false);
  });

  it('opens a configured table by stable id and exposes the returned durable session', async () => {
    const opened = session('session-1', 1);
    mockedOpen.mockResolvedValue(opened);
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    await act(async () => {
      await result.current.openSession('01');
    });
    expect(mockedOpen).toHaveBeenCalledWith({ tableId: 't1' });
    expect(result.current.entries.find((entry) => entry.table.tableNumber === '01')?.session?.serviceSessionId).toBe(
      'session-1',
    );
  });

  it('opens an alphanumeric configured table by stable id', async () => {
    mockedTables.mockResolvedValueOnce([
      {
        id: 'table-11a',
        tableNumber: '11a',
        maxGuests: 4,
        isActive: true,
        isOutdoor: false,
        positionX: 1,
        positionY: 1,
      },
    ]);
    mockedSessions.mockResolvedValueOnce([]);
    const opened = { ...session('session-11a', 11), tableNumber: null, tableLabel: '11a' };
    mockedOpen.mockResolvedValue(opened);
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    await act(async () => {
      await result.current.openSession('11a');
    });

    expect(mockedOpen).toHaveBeenCalledWith({ tableId: 'table-11a' });
    expect(result.current.entries.find((entry) => entry.table.tableNumber === '11a')?.session?.serviceSessionId).toBe(
      'session-11a',
    );
  });

  it('keeps leading-zero table labels distinct when opening by stable id', async () => {
    mockedTables.mockResolvedValueOnce([
      { id: 'table-1', tableNumber: '1', maxGuests: 2, isActive: true, isOutdoor: false, positionX: 1, positionY: 1 },
      {
        id: 'table-01',
        tableNumber: '01',
        maxGuests: 2,
        isActive: true,
        isOutdoor: false,
        positionX: 2,
        positionY: 1,
      },
    ]);
    mockedSessions.mockResolvedValueOnce([]);
    mockedOpen.mockResolvedValue(session('session-01', 1));
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    await act(async () => {
      await result.current.openSession('01');
    });

    expect(mockedOpen).toHaveBeenCalledWith({ tableId: 'table-01' });
    expect(result.current.entries.find((entry) => entry.table.id === 'table-1')?.session).toBeNull();
    expect(result.current.entries.find((entry) => entry.table.id === 'table-01')?.session?.serviceSessionId).toBe(
      'session-01',
    );
  });

  it('keeps an opening failure visible to the cashier', async () => {
    mockedOpen.mockRejectedValue(new Error('cashier.tables.open_failed'));
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    await act(async () => {
      await expect(result.current.openSession('01')).rejects.toThrow('cashier.tables.open_failed');
    });

    expect(result.current.error).toBe('cashier.tables.open_failed');
  });

  it('prioritizes a table whose server requested cashier payment', async () => {
    mockedSessions.mockResolvedValue([
      session('session-4', 4),
      { ...session('session-5', 5), hasPendingPaymentHandoff: true },
    ]);

    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    expect(result.current.entries[0]?.session?.serviceSessionId).toBe('session-5');
    expect(result.current.entries[0]?.session?.hasPendingPaymentHandoff).toBe(true);
  });

  it('does not let a refresh started before opening overwrite the new session', async () => {
    const pendingTables = deferred<TableDto[]>();
    const pendingSessions = deferred<TableServiceSessionDto[]>();
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    mockedTables.mockReturnValueOnce(pendingTables.promise);
    mockedSessions.mockReturnValueOnce(pendingSessions.promise);
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });
    const opened = session('session-1', 1);
    mockedOpen.mockResolvedValueOnce(opened);
    await act(async () => {
      await result.current.openSession('01');
    });

    pendingTables.resolve([
      { id: 't1', tableNumber: '01', maxGuests: 2, isActive: true, isOutdoor: false, positionX: 1, positionY: 1 },
    ]);
    pendingSessions.resolve([]);
    await act(async () => {
      await refreshPromise;
    });
    expect(result.current.entries.find((entry) => entry.table.tableNumber === '01')?.session?.serviceSessionId).toBe(
      'session-1',
    );
  });
});

it('keeps a label-only visit visible under its configured label instead of a null table number', async () => {
  const labelOnly: TableServiceSessionDto = {
    ...session('session-tqa', 1),
    serviceSessionId: 'session-tqa',
    tableNumber: null,
    tableLabel: 'T-QA',
  };
  mockedSessions.mockResolvedValue([session('session-4', 4), labelOnly]);
  const { result } = renderHook(() => useCashierTables());
  await waitFor(() => expect(result.current.queueState).toBe('ready'));

  const numbers = result.current.entries.map((entry) => entry.table.tableNumber);
  expect(numbers).toContain('T-QA');
  expect(numbers).not.toContain('null');
  const labelEntry = result.current.entries.find((entry) => entry.table.tableNumber === 'T-QA');
  expect(labelEntry?.session?.serviceSessionId).toBe('session-tqa');
  expect(labelEntry?.status).toBe('occupied');
});
