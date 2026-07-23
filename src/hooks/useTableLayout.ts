import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableDto, UpdateTableDto, CreateTableDto } from '@/types/reservation';
import tableLayoutService from '@/services/tableLayoutService';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/tableCanvasGeometry';
import { useTableEntrance } from './table-layout/useTableEntrance';
import { useTableDragState } from './table-layout/useTableDragState';
import { useTableSelection } from './table-layout/useTableSelection';

export function useTableLayout() {
  const { t } = useTranslation();
  const [tables, setTables] = useState<TableDto[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalData, setDeleteModalData] = useState<{ tableNumber?: string; tableCount?: number }>({});

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const loadTables = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tableLayoutService.getAllTables();
      setTables(data);
    } catch (error: any) {
      showMessage('error', error.message || t('failed_to_load_tables', 'Failed to load tables'));
    } finally {
      setLoading(false);
    }
  }, [showMessage, t]);

  const entrance = useTableEntrance(showMessage);
  const dragState = useTableDragState();
  const selection = useTableSelection({
    tables,
    loadTables,
    showMessage,
    setSaving,
    setShowDeleteModal,
    setDeleteModalData,
  });

  const updateSelectedTable = useCallback(
    (updates: Partial<TableDto>) => {
      setSelectedTable((prev) => (prev ? { ...prev, ...updates } : null));
      setTables((prev) => prev.map((t) => (t.id === selectedTable?.id ? { ...t, ...updates } : t)));
    },
    [selectedTable?.id],
  );

  const handleDeleteTable = useCallback(async () => {
    if (!selectedTable) return;

    setDeleteModalData({ tableNumber: selectedTable.tableNumber });
    setShowDeleteModal(true);
  }, [selectedTable]);

  const confirmDeleteTable = useCallback(async () => {
    if (!selectedTable) return;

    try {
      setSaving(true);
      await tableLayoutService.deleteTable(selectedTable.id);
      setTables((prev) => prev.filter((t) => t.id !== selectedTable.id));
      setSelectedTable(null);
      setShowDeleteModal(false);
      showMessage(
        'success',
        t('table_deleted_successfully', 'Table {{tableNumber}} deleted successfully!').replace(
          '{{tableNumber}}',
          selectedTable.tableNumber,
        ),
      );
    } catch (error: any) {
      showMessage('error', error.message || t('failed_to_delete_table', 'Failed to delete table'));
    } finally {
      setSaving(false);
    }
  }, [selectedTable, showMessage, t]);

  const handleCreateTable = useCallback(
    async (tableData: CreateTableDto): Promise<TableDto> => {
      try {
        const newTable = await tableLayoutService.createTable(tableData);
        setTables((prev) => [...prev, newTable]);
        setSelectedTable(newTable);
        showMessage(
          'success',
          t('table_created_successfully', 'Table {{tableNumber}} created successfully!').replace(
            '{{tableNumber}}',
            newTable.tableNumber,
          ),
        );
        return newTable;
      } catch (error: any) {
        showMessage('error', error.message || t('failed_to_create_table', 'Failed to create table'));
        throw error;
      }
    },
    [showMessage, t],
  );

  const handleSaveLayout = useCallback(async () => {
    try {
      setSaving(true);
      const updates = tables.map(async (table) => {
        const updateData: UpdateTableDto = {
          tableNumber: table.tableNumber,
          maxGuests: table.maxGuests,
          isActive: table.isActive,
          isOutdoor: table.isOutdoor,
          positionX: table.positionX,
          positionY: table.positionY,
          notes: table.notes,
        };
        await tableLayoutService.updateTable(table.id, updateData);
      });

      await Promise.all(updates);
      await loadTables();
      showMessage('success', t('layout_saved_successfully', 'Layout saved successfully!'));
    } catch (error: any) {
      showMessage('error', error.message || t('failed_to_save_layout', 'Failed to save layout'));
    } finally {
      setSaving(false);
    }
  }, [tables, loadTables, showMessage, t]);

  return {
    // State
    tables,
    setTables,
    selectedTable,
    setSelectedTable,
    draggingTable: dragState.draggingTable,
    setDraggingTable: dragState.setDraggingTable,
    draggingEntrance: dragState.draggingEntrance,
    setDraggingEntrance: dragState.setDraggingEntrance,
    entrancePosition: entrance.entrancePosition,
    setEntrancePosition: entrance.setEntrancePosition,
    dragOffset: dragState.dragOffset,
    setDragOffset: dragState.setDragOffset,
    loading,
    saving,
    message,
    selectedTableIds: selection.selectedTableIds,
    setSelectedTableIds: selection.setSelectedTableIds,
    showDeleteModal,
    setShowDeleteModal,
    deleteModalData,

    // Actions
    showMessage,
    loadTables,
    loadEntrancePosition: entrance.loadEntrancePosition,
    saveEntrancePosition: entrance.saveEntrancePosition,
    updateSelectedTable,
    handleCreateTable,
    handleDeleteTable,
    confirmDeleteTable,
    handleSaveLayout,
    toggleTableSelection: selection.toggleTableSelection,
    bulkActivateTables: selection.bulkActivateTables,
    bulkDeactivateTables: selection.bulkDeactivateTables,
    bulkDeleteTables: selection.bulkDeleteTables,
    confirmBulkDeleteTables: selection.confirmBulkDeleteTables,

    // Constants
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  };
}
