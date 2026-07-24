'use client';

import { useTranslation } from 'react-i18next';
import { Pencil, QrCode, Trash2 } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { FloorPlanTableShape } from '@/types/floorPlan';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';
import { snapAngle } from '@/lib/floorPlan/snapping';
import EditorNumberField from './EditorNumberField';
import EditorRotationControls from './EditorRotationControls';
import styles from './EditorInspector.module.css';

const SHAPES: FloorPlanTableShape[] = ['round', 'square', 'rectangle', 'booth'];

interface EditorInspectorProps {
  editor: FloorPlanEditorApi;
  /** Table metadata / lifecycle ops (‑> /api/tables); locked while geometry is unsaved. */
  metadataLocked: boolean;
  onEditDetails: () => void;
  onShowQR: () => void;
  onDelete: () => void;
}

/**
 * The inspector (FLOOR-PLAN-REVAMP §4.3) — exact, no-drag control of the
 * selected table: numeric X/Y/W/H and rotation (chips + steppers), footprint
 * shape, and the table's metadata/QR/delete actions. Geometry writes go to the
 * plan document (saved via one PUT); metadata + lifecycle go to /api/tables, so
 * they are disabled until the geometry is saved to avoid discarding edits.
 */
export default function EditorInspector({
  editor,
  metadataLocked,
  onEditDetails,
  onShowQR,
  onDelete,
}: Readonly<EditorInspectorProps>) {
  const { t } = useTranslation();
  const table = editor.selectedTable;

  if (!table) {
    return (
      <aside className={styles.panel} aria-label={t('editor_inspector', 'Table properties')}>
        <p className={styles.empty}>
          {t('editor_select_hint', 'Select a table to edit its position, size and rotation.')}
        </p>
      </aside>
    );
  }

  const set = (patch: Partial<typeof table>) => editor.mutateTable(table.id, patch);
  const plan = editor.document;

  return (
    <aside className={styles.panel} aria-label={t('editor_inspector', 'Table properties')}>
      <h2 className={styles.heading}>{t('editor_table_heading', 'Table {{number}}', { number: table.tableNumber })}</h2>
      <p className={styles.meta}>{t('editor_seats', '{{count}} seats', { count: table.maxGuests })}</p>

      <div className={styles.grid}>
        <EditorNumberField
          label={t('editor_x', 'X (m)')}
          value={table.positionX}
          min={0}
          max={plan.widthMeters}
          onCommit={(v) => set({ positionX: v })}
        />
        <EditorNumberField
          label={t('editor_y', 'Y (m)')}
          value={table.positionY}
          min={0}
          max={plan.heightMeters}
          onCommit={(v) => set({ positionY: v })}
        />
        <EditorNumberField
          label={t('editor_width', 'Width (m)')}
          value={table.width}
          min={0.1}
          max={plan.widthMeters}
          onCommit={(v) => set({ width: v })}
        />
        <EditorNumberField
          label={t('editor_height', 'Height (m)')}
          value={table.height}
          min={0.1}
          max={plan.heightMeters}
          onCommit={(v) => set({ height: v })}
        />
      </div>

      <FormField label={t('editor_shape', 'Shape')} className={styles.field}>
        <select
          className={styles.select}
          value={table.shape}
          onChange={(e) => set({ shape: e.target.value as FloorPlanTableShape })}
        >
          {SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {t(`editor_shape_${shape}`, shape)}
            </option>
          ))}
        </select>
      </FormField>

      <EditorNumberField
        label={t('editor_rotation', 'Rotation (°)')}
        value={table.rotation}
        step={1}
        onCommit={(v) => set({ rotation: snapAngle(v, 1) })}
      />
      <EditorRotationControls rotation={table.rotation} onSet={(deg) => set({ rotation: deg })} />

      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={metadataLocked} onClick={onEditDetails}>
          <Pencil size={15} aria-hidden="true" /> {t('editor_edit_details', 'Edit details')}
        </button>
        <button type="button" className={styles.action} disabled={metadataLocked} onClick={onShowQR}>
          <QrCode size={15} aria-hidden="true" /> {t('editor_qr_code', 'QR code')}
        </button>
        <button type="button" className={styles.actionDanger} disabled={metadataLocked} onClick={onDelete}>
          <Trash2 size={15} aria-hidden="true" /> {t('editor_delete_table', 'Delete')}
        </button>
      </div>
      {metadataLocked && (
        <p className={styles.lockHint}>{t('editor_save_first', 'Save layout changes before editing table details.')}</p>
      )}
    </aside>
  );
}
