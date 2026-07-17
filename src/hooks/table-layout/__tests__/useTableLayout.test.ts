import { act, renderHook } from '@testing-library/react';
import type { TableDto } from '@/types/reservation';
import tableLayoutService from '@/services/tableLayoutService';
import { useTableLayout } from '../../useTableLayout';

// Stub react-i18next so t() returns the English fallback without a provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// The orchestrator's CRUD path calls the layout service; mock it. The
// hook imports the default export, so expose the same jest.fn() object
// as both default and named.
jest.mock('@/services/tableLayoutService', () => {
  const svc = {
    getAllTables: jest.fn(),
    updateTable: jest.fn(),
    createTable: jest.fn(),
    deleteTable: jest.fn(),
  };
  return { __esModule: true, default: svc, tableLayoutService: svc };
});

const svc = tableLayoutService as unknown as {
  getAllTables: jest.Mock;
  updateTable: jest.Mock;
  createTable: jest.Mock;
  deleteTable: jest.Mock;
};

// The composed public surface the sole consumer (table-layout-editor
// page) relies on. Guards the "byte-identical return shape" contract of
// the decomposition — a dropped/renamed key breaks this test.
const EXPECTED_KEYS = [
  'tables',
  'setTables',
  'selectedTable',
  'setSelectedTable',
  'draggingTable',
  'setDraggingTable',
  'draggingEntrance',
  'setDraggingEntrance',
  'entrancePosition',
  'setEntrancePosition',
  'dragOffset',
  'setDragOffset',
  'loading',
  'saving',
  'message',
  'selectedTableIds',
  'setSelectedTableIds',
  'showDeleteModal',
  'setShowDeleteModal',
  'deleteModalData',
  'showMessage',
  'loadTables',
  'loadEntrancePosition',
  'saveEntrancePosition',
  'updateSelectedTable',
  'handleCreateTable',
  'handleDeleteTable',
  'confirmDeleteTable',
  'handleSaveLayout',
  'toggleTableSelection',
  'bulkActivateTables',
  'bulkDeactivateTables',
  'bulkDeleteTables',
  'confirmBulkDeleteTables',
  'CANVAS_WIDTH',
  'CANVAS_HEIGHT',
];

function makeTable(overrides: Partial<TableDto> = {}): TableDto {
  return {
    id: 't1',
    tableNumber: '1',
    maxGuests: 4,
    isActive: true,
    isOutdoor: false,
    positionX: 100,
    positionY: 100,
    width: 60,
    height: 60,
    shape: 'circle',
    rotation: 0,
    ...overrides,
  };
}

describe('useTableLayout (orchestrator)', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => localStorage.clear());

  it('exposes the full public API surface unchanged after decomposition', () => {
    svc.getAllTables.mockResolvedValue([]);
    const { result } = renderHook(() => useTableLayout());

    expect(Object.keys(result.current).sort()).toEqual([...EXPECTED_KEYS].sort());
    expect(result.current.CANVAS_WIDTH).toBe(600);
    expect(result.current.CANVAS_HEIGHT).toBe(500);
  });

  it('wires the entrance sub-hook: loadEntrancePosition hydrates from localStorage', () => {
    svc.getAllTables.mockResolvedValue([]);
    localStorage.setItem('entrancePosition', JSON.stringify({ x: 22, y: 33 }));
    const { result } = renderHook(() => useTableLayout());

    act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 22, y: 33 });
  });

  it('loadTables populates tables and clears the loading flag (success)', async () => {
    const rows = [makeTable({ id: 't1' })];
    svc.getAllTables.mockResolvedValue(rows);
    const { result } = renderHook(() => useTableLayout());

    await act(async () => {
      await result.current.loadTables();
    });

    expect(result.current.tables).toEqual(rows);
    expect(result.current.loading).toBe(false);
  });

  it('surfaces an error message and auto-clears it after 3s when loadTables fails', async () => {
    jest.useFakeTimers();
    svc.getAllTables.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useTableLayout());

    await act(async () => {
      await result.current.loadTables();
    });

    expect(result.current.message).toEqual({ type: 'error', text: 'network down' });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.message).toBeNull();
    jest.useRealTimers();
  });
});
