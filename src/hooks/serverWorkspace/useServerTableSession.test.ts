import { act, renderHook, waitFor } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import { getTableServiceSession, openTableServiceSession } from '@/services/tableServiceSessionService';
import { useServerFloorSnapshot } from './useServerFloorSnapshot';
import { useServerTableSession } from './useServerTableSession';
import type { ServerFloorSnapshot, ServerFloorTable } from '@/types/serverWorkspace';

jest.mock('@/services/tableServiceSessionService');
jest.mock('./useServerFloorSnapshot');

const mockGetSession = getTableServiceSession as jest.MockedFunction<typeof getTableServiceSession>;
const mockOpenSession = openTableServiceSession as jest.MockedFunction<typeof openTableServiceSession>;
const mockUseFloor = useServerFloorSnapshot as jest.MockedFunction<typeof useServerFloorSnapshot>;

const baseTable = (overrides: Partial<ServerFloorTable> = {}): ServerFloorTable => ({
  tableId: 'table-1',
  tableLabel: '1',
  zoneId: 'zone-1',
  zoneName: 'Main room',
  isActive: true,
  isOutdoor: false,
  maxGuests: 4,
  positionX: 1,
  positionY: 1,
  width: 1,
  height: 1,
  shape: 'round',
  rotation: 0,
  state: 'Available',
  activeRoundCount: 0,
  readyRoundCount: 0,
  reservation: null,
  legacy: null,
  hasLegacyAmbiguity: false,
  permittedActions: ['StartTable'],
  ...overrides,
});

const snapshot = (table: ServerFloorTable): ServerFloorSnapshot => ({
  serverTime: '2026-09-21T10:00:00Z',
  tenantTime: '2026-09-21T12:00:00+02:00',
  nextStateChangeAt: null,
  version: 'floor-v1',
  cursor: 'floor-v1',
  zones: [],
  tables: [table],
});

const session = (overrides: Partial<TableServiceSessionDto> = {}): TableServiceSessionDto => ({
  serviceSessionId: 'session-1',
  tableId: 'table-1',
  tableNumber: 1,
  tableLabel: '1',
  currency: 'CHF',
  status: 'Open',
  version: 1,
  openedAt: '2026-09-21T09:00:00Z',
  closedAt: null,
  roundCount: 1,
  ageMinutes: 60,
  outstanding: 20,
  bill: {
    tableId: 'table-1',
    tableNumber: 1,
    tableLabel: '1',
    serviceSessionId: 'session-1',
    serviceSessionVersion: 1,
    currency: 'CHF',
    generatedAt: '2026-09-21T10:00:00Z',
    rounds: [],
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
  ...overrides,
});

const floorState = (table: ServerFloorTable, isStale = false) => ({
  snapshot: snapshot(table),
  isLoading: false,
  isStale,
  error: null,
  connectionState: isStale ? ('stale' as const) : ('connected' as const),
  refresh: jest.fn(async () => undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFloor.mockReturnValue(floorState(baseTable()));
  mockGetSession.mockResolvedValue(session());
  mockOpenSession.mockResolvedValue(session());
});

describe('useServerTableSession', () => {
  it('starts an available table by stable table id and keeps the numeric caller out of the payload', async () => {
    const opened = session({ serviceSessionId: 'opened-session' });
    mockOpenSession.mockResolvedValue(opened);
    const { result } = renderHook(() => useServerTableSession('table-1'));

    await waitFor(() => expect(result.current.canStartTable).toBe(true));
    await act(async () => {
      await result.current.startTable();
    });

    expect(mockOpenSession).toHaveBeenCalledWith({ tableId: 'table-1' });
    expect(mockUseFloor().refresh).toHaveBeenCalledTimes(1);
    expect(result.current.session).toEqual(opened);
    expect(result.current.isStale).toBe(true);
    expect(result.current.canAddRound).toBe(false);
  });

  it('retains a committed open as stale when floor reconciliation fails', async () => {
    const currentFloor = floorState(baseTable());
    currentFloor.refresh.mockRejectedValueOnce(new Error('floor unavailable'));
    mockUseFloor.mockReturnValue(currentFloor);
    const opened = session({ serviceSessionId: 'opened-session' });
    mockOpenSession.mockResolvedValue(opened);
    const { result } = renderHook(() => useServerTableSession('table-1'));

    await act(async () => {
      await expect(result.current.startTable()).resolves.toEqual(opened);
    });

    expect(result.current.session).toEqual(opened);
    expect(result.current.isStale).toBe(true);
    expect(result.current.error).toBe('cashier.tables.session_unavailable');
    expect(result.current.canAddRound).toBe(false);
  });

  it('reads an open session through the explicit session route and retains its bill after a transient failure', async () => {
    const openTable = baseTable({
      state: 'Open',
      activeRoundCount: 1,
      session: {
        serviceSessionId: 'session-1',
        version: 1,
        openedAt: '2026-09-21T09:00:00Z',
        ageMinutes: 60,
        total: 20,
        paid: 0,
        remaining: 20,
        activeRoundCount: 1,
        readyRoundCount: 0,
        canCollect: true,
        canClose: false,
        hasLegacyAmbiguity: false,
      },
    });
    mockUseFloor.mockReturnValue(floorState(openTable));
    const { result } = renderHook(() => useServerTableSession('table-1'));
    await waitFor(() => expect(result.current.session?.serviceSessionId).toBe('session-1'));
    expect(mockGetSession).toHaveBeenCalledWith('session-1');

    mockGetSession.mockRejectedValueOnce(new Error('temporary outage'));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.session?.serviceSessionId).toBe('session-1');
    expect(result.current.isStale).toBe(true);
    expect(result.current.canAddRound).toBe(false);
  });

  it.each([
    ['Reserved', 'reserved'],
    ['Inactive', 'inactive'],
    ['Ambiguous', 'ambiguous'],
    ['Mystery', 'unavailable'],
  ] as const)('fails closed for %s tables', (tableState, blocker) => {
    mockUseFloor.mockReturnValue(floorState(baseTable({ state: tableState as ServerFloorTable['state'] })));
    const { result } = renderHook(() => useServerTableSession('table-1'));

    expect(result.current.blocker).toBe(blocker);
    expect(result.current.canStartTable).toBe(false);
    expect(result.current.canAddRound).toBe(false);
    expect(mockOpenSession).not.toHaveBeenCalled();
  });

  it('fails closed when a fresh open floor row has lost its session identity', () => {
    mockUseFloor.mockReturnValue(floorState(baseTable({ state: 'Open' })));
    const { result } = renderHook(() => useServerTableSession('table-1'));

    expect(result.current.blocker).toBe('missing-session');
    expect(result.current.canStartTable).toBe(false);
  });

  it('blocks writes from a stale floor while retaining the table snapshot', () => {
    mockUseFloor.mockReturnValue(floorState(baseTable(), true));
    const { result } = renderHook(() => useServerTableSession('table-1'));

    expect(result.current.table?.tableId).toBe('table-1');
    expect(result.current.blocker).toBe('stale');
    expect(result.current.canStartTable).toBe(false);
  });

  it('does not invent actions omitted by the authoritative floor contract', async () => {
    mockUseFloor.mockReturnValue(floorState(baseTable({ permittedActions: [] })));
    const { result } = renderHook(() => useServerTableSession('table-1'));

    expect(result.current.canStartTable).toBe(false);

    const openTable = baseTable({
      state: 'Open',
      permittedActions: ['ViewBill'],
      session: {
        serviceSessionId: 'session-1',
        version: 1,
        openedAt: '2026-09-21T09:00:00Z',
        ageMinutes: 60,
        total: 20,
        paid: 0,
        remaining: 20,
        activeRoundCount: 1,
        readyRoundCount: 0,
        canCollect: false,
        canClose: false,
        hasLegacyAmbiguity: false,
      },
    });
    mockUseFloor.mockReturnValue(floorState(openTable));
    const open = renderHook(() => useServerTableSession('table-1'));
    await waitFor(() => expect(open.result.current.session).not.toBeNull());
    expect(open.result.current.canAddRound).toBe(false);
  });

  it('drops an old session when a fresh floor row removes its session identity', async () => {
    const openTable = baseTable({
      state: 'Open',
      permittedActions: ['AddRound'],
      session: {
        serviceSessionId: 'session-1',
        version: 1,
        openedAt: '2026-09-21T09:00:00Z',
        ageMinutes: 60,
        total: 20,
        paid: 0,
        remaining: 20,
        activeRoundCount: 1,
        readyRoundCount: 0,
        canCollect: false,
        canClose: false,
        hasLegacyAmbiguity: false,
      },
    });
    mockUseFloor.mockReturnValue(floorState(openTable));
    const { result, rerender } = renderHook(() => useServerTableSession('table-1'));
    await waitFor(() => expect(result.current.session).not.toBeNull());

    mockUseFloor.mockReturnValue(floorState(baseTable({ state: 'Available' })));
    rerender();

    await waitFor(() => expect(result.current.session).toBeNull());
    expect(result.current.canAddRound).toBe(false);
  });
});
