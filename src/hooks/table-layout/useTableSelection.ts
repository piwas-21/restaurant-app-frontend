'use client';

import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableDto, UpdateTableDto } from '@/types/reservation';
import tableLayoutService from '@/services/tableLayoutService';

/**
 * Preserves the original `error.message || fallback` behaviour under the
 * `no-any` rule: returns the message off an Error — or any thrown object that
 * carries a string `message` — otherwise '' so the caller uses its fallback.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message;
  }
  return '';
}

export interface UseTableSelectionOptions {
  tables: TableDto[];
  loadTables: () => Promise<void>;
  showMessage: (type: 'success' | 'error', text: string) => void;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setShowDeleteModal: Dispatch<SetStateAction<boolean>>;
  setDeleteModalData: Dispatch<SetStateAction<{ tableNumber?: string; tableCount?: number }>>;
}

/**
 * Multi-select set plus the bulk activate / deactivate / delete
 * operations that act on it. Bulk delete defers to the shared
 * delete-confirm modal (state owned by the orchestrator) and only
 * issues the deletes on confirm.
 */
export function useTableSelection({
  tables,
  loadTables,
  showMessage,
  setSaving,
  setShowDeleteModal,
  setDeleteModalData,
}: UseTableSelectionOptions) {
  const { t } = useTranslation();
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());

  const toggleTableSelection = useCallback((tableId: string) => {
    setSelectedTableIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) {
        newSet.delete(tableId);
      } else {
        newSet.add(tableId);
      }
      return newSet;
    });
  }, []);

  // Activate and deactivate are the same flow parametrised by the target
  // state: activate touches inactive tables, deactivate touches active ones.
  const applyBulkActiveState = useCallback(
    async (makeActive: boolean) => {
      if (selectedTableIds.size === 0) {
        showMessage('error', t('no_tables_selected', 'No tables selected'));
        return;
      }

      // Copy selected once by target state, so the flow below stays branch-free.
      const copy = makeActive
        ? {
            successKey: 'tables_activated',
            successFallback: 'Activated {{count}} table(s)',
            emptyKey: 'no_inactive_tables',
            emptyFallback: 'No inactive tables to activate',
            failKey: 'failed_to_activate_tables',
            failFallback: 'Failed to activate tables',
          }
        : {
            successKey: 'tables_deactivated',
            successFallback: 'Deactivated {{count}} table(s)',
            emptyKey: 'no_active_tables',
            emptyFallback: 'No active tables to deactivate',
            failKey: 'failed_to_deactivate_tables',
            failFallback: 'Failed to deactivate tables',
          };

      try {
        setSaving(true);
        const updates = Array.from(selectedTableIds).map(async (tableId) => {
          const table = tables.find((t) => t.id === tableId);
          if (table && table.isActive !== makeActive) {
            const updateData: UpdateTableDto = {
              ...table,
              isActive: makeActive,
              shape: table.shape || 'circle',
            };
            await tableLayoutService.updateTable(tableId, updateData);
            return tableId;
          }
          return null;
        });

        const updated = (await Promise.all(updates)).filter(Boolean);
        if (updated.length > 0) {
          await loadTables();
          showMessage(
            'success',
            t(copy.successKey, copy.successFallback).replace('{{count}}', updated.length.toString()),
          );
          setSelectedTableIds(new Set());
        } else {
          showMessage('error', t(copy.emptyKey, copy.emptyFallback));
        }
      } catch (error: unknown) {
        showMessage('error', extractErrorMessage(error) || t(copy.failKey, copy.failFallback));
      } finally {
        setSaving(false);
      }
    },
    [selectedTableIds, tables, loadTables, showMessage, setSaving, t],
  );

  const bulkActivateTables = useCallback(() => applyBulkActiveState(true), [applyBulkActiveState]);
  const bulkDeactivateTables = useCallback(() => applyBulkActiveState(false), [applyBulkActiveState]);

  const bulkDeleteTables = useCallback(async () => {
    if (selectedTableIds.size === 0) {
      showMessage('error', t('no_tables_selected', 'No tables selected'));
      return;
    }

    setDeleteModalData({ tableCount: selectedTableIds.size });
    setShowDeleteModal(true);
  }, [selectedTableIds.size, showMessage, setDeleteModalData, setShowDeleteModal, t]);

  const confirmBulkDeleteTables = useCallback(async () => {
    if (selectedTableIds.size === 0) return;

    try {
      setSaving(true);
      const deletes = Array.from(selectedTableIds).map(async (tableId) => {
        await tableLayoutService.deleteTable(tableId);
        return tableId;
      });

      const count = selectedTableIds.size;
      await Promise.all(deletes);
      await loadTables();
      setShowDeleteModal(false);
      showMessage('success', t('tables_deleted', 'Deleted {{count}} table(s)').replace('{{count}}', count.toString()));
      setSelectedTableIds(new Set());
    } catch (error: unknown) {
      showMessage('error', extractErrorMessage(error) || t('failed_to_delete_tables', 'Failed to delete tables'));
    } finally {
      setSaving(false);
    }
  }, [selectedTableIds, loadTables, showMessage, setSaving, setShowDeleteModal, t]);

  return {
    selectedTableIds,
    setSelectedTableIds,
    toggleTableSelection,
    bulkActivateTables,
    bulkDeactivateTables,
    bulkDeleteTables,
    confirmBulkDeleteTables,
  };
}
