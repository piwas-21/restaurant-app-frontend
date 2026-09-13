import { act, renderHook, waitFor } from '@testing-library/react';
import type { TableDto } from '@/types/reservation';
import type { TableServiceSessionDto } from '@/types/order';
import { getCashierTables } from '@/services/server/tables';
import { getActiveTableServiceSessions, openTableServiceSession } from '@/services/tableServiceSessionService';
import { useCashierTables } from './useCashierTables';

jest.mock('@/services/server/tables');
jest.mock('@/services/tableServiceSessionService');

const mockedTables = jest.mocked(getCashierTables);
const mockedSessions = jest.mocked(getActiveTableServiceSessions);
const mockedOpen = jest.mocked(openTableServiceSession);
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

  it('opens only an explicit numeric table and exposes the returned durable session', async () => {
    const opened = session('session-1', 1);
    mockedOpen.mockResolvedValue(opened);
    const { result } = renderHook(() => useCashierTables());
    await waitFor(() => expect(result.current.queueState).toBe('ready'));

    await act(async () => {
      await result.current.openSession('01');
    });
    expect(mockedOpen).toHaveBeenCalledWith(1);
    expect(result.current.entries.find((entry) => entry.table.tableNumber === '01')?.session?.serviceSessionId).toBe(
      'session-1',
    );
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
