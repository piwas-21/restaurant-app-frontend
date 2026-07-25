'use client';

import { useTranslation } from 'react-i18next';
import { Pencil, QrCode, Trash2 } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { FloorPlanDocument, FloorPlanTableGeometry, FloorPlanTableShape } from '@/types/floorPlan';
import { tableGeometryPatch, tableMovable, type MovableGeometry } from '@/lib/floorPlan/movable';
import EditorGeometryFields from './EditorGeometryFields';
import styles from './EditorInspector.module.css';

const SHAPES: FloorPlanTableShape[] = ['round', 'square', 'rectangle', 'booth'];

/** The server's footprint floor — `Clamp(size, 0.1m, plan)` in the mapper. */
const MIN_SIZE_M = 0.1;

/**
 * The selected table's panel (FLOOR-PLAN-REVAMP §4.3). Geometry writes go to the
 * plan document (saved by one PUT); footprint shape rides along with it. The
 * table's **metadata, QR code and deletion** are /api/tables operations, so they
 * are disabled until the geometry is saved — a reload in the middle would discard
 * the layout edits.
 */
interface EditorTablePanelProps {
  table: FloorPlanTableGeometry;
  plan: FloorPlanDocument;
  onPatch: (patch: Partial<FloorPlanTableGeometry>) => void;
  metadataLocked: boolean;
  onEditDetails: () => void;
  onShowQR: () => void;
  onDelete: () => void;
}

export default function EditorTablePanel({
  table,
  plan,
  onPatch,
  metadataLocked,
  onEditDetails,
  onShowQR,
  onDelete,
}: Readonly<EditorTablePanelProps>) {
  const { t } = useTranslation();
  const patchGeometry = (patch: Partial<MovableGeometry>) => onPatch(tableGeometryPatch(patch));

  return (
    <>
      <h2 className={styles.heading}>{t('editor_table_heading', 'Table {{number}}', { number: table.tableNumber })}</h2>
      <p className={styles.meta}>{t('editor_seats', '{{count}} seats', { count: table.maxGuests })}</p>

      <EditorGeometryFields rect={tableMovable(table)} plan={plan} minSizeMeters={MIN_SIZE_M} onPatch={patchGeometry} />

      <FormField label={t('editor_shape', 'Shape')} className={styles.field}>
        <select
          className={styles.select}
          value={table.shape}
          onChange={(e) => onPatch({ shape: e.target.value as FloorPlanTableShape })}
        >
          {SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {t(`editor_shape_${shape}`, shape)}
            </option>
          ))}
        </select>
      </FormField>

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
    </>
  );
}
