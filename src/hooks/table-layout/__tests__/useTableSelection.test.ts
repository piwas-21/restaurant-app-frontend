import { act, renderHook } from '@testing-library/react';
import type { TableDto } from '@/types/reservation';
import tableLayoutService from '@/services/tableLayoutService';
import { useTableSelection, type UseTableSelectionOptions } from '../useTableSelection';

// Stub react-i18next so t() returns the English fallback without a provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// The bulk ops call the layout service; mock it so tests drive the
// success / error branches deterministically. The hook imports the
// default export, so expose the same jest.fn() object as both.
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

function makeOptions(overrides: Partial<UseTableSelectionOptions> = {}): UseTableSelectionOptions {
  return {
    tables: [],
    loadTables: jest.fn().mockResolvedValue(undefined),
    showMessage: jest.fn(),
    setSaving: jest.fn(),
    setShowDeleteModal: jest.fn(),
    setDeleteModalData: jest.fn(),
    ...overrides,
  };
}

describe('useTableSelection', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('toggleTableSelection', () => {
    it('adds an id when absent and removes it when present', () => {
      const { result } = renderHook(() => useTableSelection(makeOptions()));

      act(() => result.current.toggleTableSelection('a'));
      expect(result.current.selectedTableIds.has('a')).toBe(true);

      act(() => result.current.toggleTableSelection('a'));
      expect(result.current.selectedTableIds.has('a')).toBe(false);
    });
  });

  describe('bulkActivateTables', () => {
    it('errors and skips the service when nothing is selected', async () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useTableSelection(opts));

      await act(async () => {
        await result.current.bulkActivateTables();
      });

      expect(opts.showMessage).toHaveBeenCalledWith('error', 'No tables selected');
      expect(svc.updateTable).not.toHaveBeenCalled();
      expect(opts.setSaving).not.toHaveBeenCalled();
    });

    it('activates selected inactive tables, reloads and clears the selection (success path)', async () => {
      const inactive = makeTable({ id: 't1', isActive: false });
      const opts = makeOptions({ tables: [inactive] });
      svc.updateTable.mockResolvedValue(inactive);

      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('t1'));

      await act(async () => {
        await result.current.bulkActivateTables();
      });

      expect(svc.updateTable).toHaveBeenCalledWith('t1', expect.objectContaining({ isActive: true, shape: 'circle' }));
      expect(opts.loadTables).toHaveBeenCalledTimes(1);
      expect(opts.showMessage).toHaveBeenCalledWith('success', 'Activated 1 table(s)');
      expect(result.current.selectedTableIds.size).toBe(0);
      expect(opts.setSaving).toHaveBeenNthCalledWith(1, true);
      expect(opts.setSaving).toHaveBeenLastCalledWith(false);
    });

    it('shows the failure message and skips reload when the service throws (error path)', async () => {
      const inactive = makeTable({ id: 't1', isActive: false });
      const opts = makeOptions({ tables: [inactive] });
      svc.updateTable.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('t1'));

      await act(async () => {
        await result.current.bulkActivateTables();
      });

      expect(opts.showMessage).toHaveBeenCalledWith('error', 'boom');
      expect(opts.loadTables).not.toHaveBeenCalled();
      // saving is always reset in the finally block.
      expect(opts.setSaving).toHaveBeenLastCalledWith(false);
    });

    it('surfaces the message from a non-Error thrown object (e.g. an API error payload)', async () => {
      const inactive = makeTable({ id: 't1', isActive: false });
      const opts = makeOptions({ tables: [inactive] });
      svc.updateTable.mockRejectedValue({ message: 'server rejected' });

      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('t1'));

      await act(async () => {
        await result.current.bulkActivateTables();
      });

      expect(opts.showMessage).toHaveBeenCalledWith('error', 'server rejected');
    });

    it('reports "no inactive tables" when the selection is already active', async () => {
      const active = makeTable({ id: 't1', isActive: true });
      const opts = makeOptions({ tables: [active] });

      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('t1'));

      await act(async () => {
        await result.current.bulkActivateTables();
      });

      expect(svc.updateTable).not.toHaveBeenCalled();
      expect(opts.showMessage).toHaveBeenCalledWith('error', 'No inactive tables to activate');
    });
  });

  describe('bulkDeactivateTables', () => {
    it('deactivates selected active tables, reloads and clears the selection (success path)', async () => {
      const active = makeTable({ id: 't1', isActive: true });
      const opts = makeOptions({ tables: [active] });
      svc.updateTable.mockResolvedValue(active);

      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('t1'));

      await act(async () => {
        await result.current.bulkDeactivateTables();
      });

      expect(svc.updateTable).toHaveBeenCalledWith('t1', expect.objectContaining({ isActive: false, shape: 'circle' }));
      expect(opts.loadTables).toHaveBeenCalledTimes(1);
      expect(opts.showMessage).toHaveBeenCalledWith('success', 'Deactivated 1 table(s)');
      expect(result.current.selectedTableIds.size).toBe(0);
      expect(opts.setSaving).toHaveBeenNthCalledWith(1, true);
      expect(opts.setSaving).toHaveBeenLastCalledWith(false);
    });
  });

  describe('bulk delete', () => {
    it('bulkDeleteTables opens the shared confirm modal with the selected count', async () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('a'));
      act(() => result.current.toggleTableSelection('b'));

      await act(async () => {
        await result.current.bulkDeleteTables();
      });

      expect(opts.setDeleteModalData).toHaveBeenCalledWith({ tableCount: 2 });
      expect(opts.setShowDeleteModal).toHaveBeenCalledWith(true);
      expect(svc.deleteTable).not.toHaveBeenCalled();
    });

    it('confirmBulkDeleteTables deletes each selected table, reloads and clears', async () => {
      const opts = makeOptions();
      svc.deleteTable.mockResolvedValue(undefined);
      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('a'));
      act(() => result.current.toggleTableSelection('b'));

      await act(async () => {
        await result.current.confirmBulkDeleteTables();
      });

      expect(svc.deleteTable).toHaveBeenCalledTimes(2);
      expect(opts.loadTables).toHaveBeenCalledTimes(1);
      expect(opts.setShowDeleteModal).toHaveBeenCalledWith(false);
      expect(opts.showMessage).toHaveBeenCalledWith('success', 'Deleted 2 table(s)');
      expect(result.current.selectedTableIds.size).toBe(0);
    });

    it('confirmBulkDeleteTables surfaces the failure and leaves the selection intact (error path)', async () => {
      const opts = makeOptions();
      svc.deleteTable.mockRejectedValue(new Error('delete failed'));
      const { result } = renderHook(() => useTableSelection(opts));
      act(() => result.current.toggleTableSelection('a'));

      await act(async () => {
        await result.current.confirmBulkDeleteTables();
      });

      expect(svc.deleteTable).toHaveBeenCalledTimes(1);
      expect(opts.showMessage).toHaveBeenCalledWith('error', 'delete failed');
      // The success-only steps must not run when a delete rejects.
      expect(opts.loadTables).not.toHaveBeenCalled();
      expect(opts.setShowDeleteModal).not.toHaveBeenCalled();
      expect(result.current.selectedTableIds.size).toBe(1);
      // saving is always reset in the finally block.
      expect(opts.setSaving).toHaveBeenLastCalledWith(false);
    });
  });
});
