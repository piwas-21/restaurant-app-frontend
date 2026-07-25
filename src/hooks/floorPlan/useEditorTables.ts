'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tableLayoutService } from '@/services/tableLayoutService';
import { generateTableQRCode } from '@/services/tableQRService';
import type { CreateTableDto, TableDto } from '@/types/reservation';

type Notify = (type: 'success' | 'error', text: string) => void;

/**
 * The table-lifecycle bridge for the editor (FLOOR-PLAN-REVAMP §5.2). Table
 * geometry saves through the floor-plan document PUT, but a table's identity,
 * metadata and QR code live on /api/tables — so create / delete / details / QR
 * stay here as `TableDto`s correlated to the plan by id. After any change the
 * caller reloads the plan document so the canvas reflects it.
 */
export function useEditorTables(notify: Notify) {
  const { t } = useTranslation();
  const [tables, setTables] = useState<TableDto[]>([]);
  const [qrTable, setQrTable] = useState<TableDto | null>(null);

  const load = useCallback(async () => {
    try {
      setTables(await tableLayoutService.getAllTables());
    } catch {
      notify('error', t('failed_to_load_tables', 'Failed to load tables'));
    }
  }, [notify, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTable = useCallback(
    async (data: CreateTableDto): Promise<TableDto> => {
      const created = await tableLayoutService.createTable(data);
      notify(
        'success',
        t('table_created_successfully', 'Table {{tableNumber}} created successfully!').replace(
          '{{tableNumber}}',
          created.tableNumber,
        ),
      );
      await load();
      return created;
    },
    [load, notify, t],
  );

  const deleteTable = useCallback(
    async (id: string, tableNumber: string) => {
      await tableLayoutService.deleteTable(id);
      notify(
        'success',
        t('table_deleted_successfully', 'Table {{tableNumber}} deleted successfully!').replace(
          '{{tableNumber}}',
          tableNumber,
        ),
      );
      await load();
    },
    [load, notify, t],
  );

  /** Optimistic local patch so the details modal reflects typing before Save. */
  const patchLocal = useCallback((id: string, updates: Partial<TableDto>) => {
    setTables((prev) => prev.map((tt) => (tt.id === id ? { ...tt, ...updates } : tt)));
  }, []);

  const saveProperties = useCallback(
    async (id: string, updates: Partial<TableDto>, position: { x: number; y: number }) => {
      const current = tables.find((tt) => tt.id === id);
      if (!current) {
        return;
      }
      // `Table.PositionX/Y` is a single column shared by /api/floorplan and
      // /api/tables, and UpdateTable writes it unconditionally. Send the
      // AUTHORITATIVE geometry from the plan document (`position`), not this
      // metadata cache — otherwise a details save reverts a previously-saved
      // drag (the cache is only refreshed on create/delete/props, never after a
      // geometry-only Save).
      await tableLayoutService.updateTable(id, {
        tableNumber: updates.tableNumber ?? current.tableNumber,
        maxGuests: updates.maxGuests ?? current.maxGuests,
        isActive: updates.isActive ?? current.isActive,
        isOutdoor: updates.isOutdoor ?? current.isOutdoor,
        positionX: position.x,
        positionY: position.y,
        notes: updates.notes ?? current.notes,
      });
      notify('success', t('table_updated_successfully', 'Table updated successfully'));
      await load();
    },
    [tables, load, notify, t],
  );

  const regenerateQR = useCallback(
    async (table: TableDto) => {
      try {
        const result = await generateTableQRCode(table.id);
        const patch = { qrCodeData: result.qrCodeData, qrCodeGeneratedAt: result.qrCodeGeneratedAt };
        patchLocal(table.id, patch);
        setQrTable((prev) => (prev?.id === table.id ? { ...prev, ...patch } : prev));
        notify('success', t('qr_code_generated_successfully', 'QR code generated successfully!'));
      } catch (err) {
        notify('error', (err as Error).message || t('failed_generate_qr_code', 'Failed to generate QR code'));
      }
    },
    [patchLocal, notify, t],
  );

  return { tables, load, createTable, deleteTable, patchLocal, saveProperties, regenerateQR, qrTable, setQrTable };
}
