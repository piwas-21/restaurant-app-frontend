'use client';

import { useTranslation } from 'react-i18next';
import { Copy, Trash2 } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { FloorPlanDocument, FloorPlanItem } from '@/types/floorPlan';
import { itemMovable, type MovableGeometry } from '@/lib/floorPlan/movable';
import { MAX_ITEM_LABEL, carriesText, isTextLabelKind } from '@/lib/floorPlan/wayfinding';
import EditorGeometryFields from './EditorGeometryFields';
import { itemKindLabel } from './itemKindLabel';
import styles from './EditorInspector.module.css';

/** The server's footprint floor — `Clamp(size, 0.1m, plan)` in the mapper. */
const MIN_SIZE_M = 0.1;

/**
 * The selected item's panel (FLOOR-PLAN-REVAMP §4.3). An item is *entirely* a
 * document edit — placed, moved, copied and deleted locally, then written by the
 * one whole-document PUT that replaces walls and items wholesale. That is why
 * Duplicate and Delete sit here with no confirmation and no lock, while the very
 * same actions on a table need an API call and a modal.
 *
 * A **zone region and a text label carry text**, and this field is the affordance
 * they were waiting on: until S8 gave it to them they were drawn but deliberately
 * not grabbable, because dragging something the inspector cannot edit is worse
 * than not being able to drag it.
 */
interface EditorItemPanelProps {
  item: FloorPlanItem;
  plan: FloorPlanDocument;
  onPatch: (patch: Partial<FloorPlanItem>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function EditorItemPanel({
  item,
  plan,
  onPatch,
  onDuplicate,
  onDelete,
}: Readonly<EditorItemPanelProps>) {
  const { t } = useTranslation();
  const rect = itemMovable(item);
  const name = itemKindLabel(t, item.kind);

  return (
    <>
      <h2 className={styles.heading}>{name}</h2>
      <p className={styles.meta}>{t('editor_item_meta', 'Saved with the layout')}</p>

      {carriesText(item.kind) && (
        <FormField
          label={isTextLabelKind(item.kind) ? t('editor_item_text', 'Text') : t('editor_zone_name', 'Zone name')}
          className={styles.field}
        >
          <input
            className={styles.number}
            type="text"
            maxLength={MAX_ITEM_LABEL}
            value={item.label ?? ''}
            // Empty is stored as null, not "": the renderers skip a name that is
            // absent, and an empty string would draw an empty tag box.
            onChange={(e) => onPatch({ label: e.target.value.trim() === '' ? null : e.target.value })}
          />
        </FormField>
      )}

      {rect && (
        <EditorGeometryFields
          rect={rect}
          plan={plan}
          minSizeMeters={MIN_SIZE_M}
          onPatch={(patch: Partial<MovableGeometry>) => onPatch(patch)}
        />
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={onDuplicate}>
          <Copy size={15} aria-hidden="true" /> {t('editor_duplicate', 'Duplicate')}
        </button>
        <button type="button" className={styles.actionDanger} onClick={onDelete}>
          <Trash2 size={15} aria-hidden="true" /> {t('editor_delete_item', 'Delete object')}
        </button>
      </div>
    </>
  );
}
