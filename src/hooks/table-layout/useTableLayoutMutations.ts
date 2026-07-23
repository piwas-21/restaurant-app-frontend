'use client';

import { Dispatch, SetStateAction, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableDto } from '@/types/reservation';
import { generateTableQRCode } from '@/services/tableQRService';

export interface UseTableLayoutMutationsOptions {
  tables: TableDto[];
  setTables: Dispatch<SetStateAction<TableDto[]>>;
  setSelectedTable: Dispatch<SetStateAction<TableDto | null>>;
  setQRModalTable: Dispatch<SetStateAction<TableDto | null>>;
  showMessage: (type: 'success' | 'error', text: string) => void;
}

/**
 * The two non-drag mutations the page issues directly: persist a
 * properties update for one table and regenerate a table's QR code.
 */
export function useTableLayoutMutations({
  tables,
  setTables,
  setSelectedTable,
  setQRModalTable,
  showMessage,
}: UseTableLayoutMutationsOptions) {
  const { t } = useTranslation();

  const saveTableProperties = useCallback(
    async (tableId: string, updates: Partial<TableDto>) => {
      const tableLayoutService = (await import('@/services/tableLayoutService')).tableLayoutService;
      const current = tables.find((tt) => tt.id === tableId);
      if (!current) throw new Error(t('table_not_found', 'Table not found'));

      const updateData = {
        tableNumber: updates.tableNumber ?? current.tableNumber,
        maxGuests: updates.maxGuests ?? current.maxGuests,
        isActive: updates.isActive ?? current.isActive,
        isOutdoor: updates.isOutdoor ?? current.isOutdoor,
        positionX: updates.positionX ?? current.positionX,
        positionY: updates.positionY ?? current.positionY,
        notes: updates.notes ?? current.notes,
      };

      try {
        const updated = await tableLayoutService.updateTable(tableId, updateData);
        setTables((prev) => prev.map((tt) => (tt.id === tableId ? { ...tt, ...updated } : tt)));
        showMessage('success', t('table_updated_successfully', 'Table updated successfully'));
      } catch (err) {
        throw new Error((err as Error).message || t('failed_to_update_table', 'Failed to update table'));
      }
    },
    [tables, setTables, showMessage, t],
  );

  const regenerateQRCode = useCallback(
    async (qrModalTable: TableDto) => {
      try {
        const result = await generateTableQRCode(qrModalTable.id);
        const patch = { qrCodeData: result.qrCodeData, qrCodeGeneratedAt: result.qrCodeGeneratedAt };
        setTables((prev) => prev.map((tt) => (tt.id === qrModalTable.id ? { ...tt, ...patch } : tt)));
        setQRModalTable((prev) => (prev ? { ...prev, ...patch } : null));
        setSelectedTable((prev) => (prev && prev.id === qrModalTable.id ? { ...prev, ...patch } : prev));
        showMessage('success', t('qr_code_generated_successfully', 'QR code generated successfully!'));
      } catch (err) {
        showMessage('error', (err as Error).message || t('failed_generate_qr_code', 'Failed to generate QR code'));
      }
    },
    [setTables, setQRModalTable, setSelectedTable, showMessage, t],
  );

  return { saveTableProperties, regenerateQRCode };
}
