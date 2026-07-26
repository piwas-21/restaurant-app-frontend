'use client';

import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { FloorPlanOpening, FloorPlanOpeningKind } from '@/types/floorPlan';
import type { WallSegment } from '@/lib/floorPlan/walls';
import { MIN_OPENING_WIDTH_M, OPENING_KINDS, SWING_DIRECTIONS } from '@/lib/floorPlan/wallOpenings';
import EditorNumberField from './EditorNumberField';
import styles from './EditorInspector.module.css';

/**
 * One door / window / gap on a wall (FLOOR-PLAN-REVAMP §4.3). Every field here is
 * a property of the **segment it sits on** — which side, how far along it, how
 * wide — because that is how an opening is stored, and it is what makes a doorway
 * structurally unable to float off its wall.
 *
 * The offset and width maxima come from the chosen side's length, so the fields
 * cannot express a position the save would silently clamp.
 */
interface EditorOpeningRowProps {
  opening: FloorPlanOpening;
  segments: readonly WallSegment[];
  onPatch: (patch: Partial<FloorPlanOpening>) => void;
  onRemove: () => void;
}

export default function EditorOpeningRow({ opening, segments, onPatch, onRemove }: Readonly<EditorOpeningRowProps>) {
  const { t } = useTranslation();
  const segment = segments[opening.segmentIndex];
  const maxWidth = segment?.length ?? MIN_OPENING_WIDTH_M;

  return (
    <li className={styles.openingRow}>
      <div className={styles.grid}>
        <FormField label={t('editor_opening_kind', 'Type')} className={styles.field}>
          <select
            className={styles.select}
            value={opening.kind}
            onChange={(e) => onPatch({ kind: e.target.value as FloorPlanOpeningKind })}
          >
            {OPENING_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`editor_opening_${kind}`, kind)}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label={t('editor_opening_side', 'Side')} className={styles.field}>
          <select
            className={styles.select}
            value={opening.segmentIndex}
            onChange={(e) => onPatch({ segmentIndex: Number(e.target.value) })}
          >
            {segments.map((s) => (
              <option key={s.index} value={s.index}>
                {t('editor_wall_side_n', 'Side {{n}} · {{length}} m', {
                  n: s.index + 1,
                  length: s.length.toFixed(2),
                })}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className={styles.grid}>
        <EditorNumberField
          label={t('editor_opening_offset', 'From corner (m)')}
          value={opening.offsetMeters}
          min={0}
          max={Math.max(maxWidth - opening.widthMeters, 0)}
          onCommit={(v) => onPatch({ offsetMeters: v })}
        />
        <EditorNumberField
          label={t('editor_opening_width', 'Width (m)')}
          value={opening.widthMeters}
          min={MIN_OPENING_WIDTH_M}
          max={maxWidth}
          onCommit={(v) => onPatch({ widthMeters: v })}
        />
      </div>

      {/* Only a door has a leaf to swing; a window or a gap carries `none`. */}
      {opening.kind === 'door' && (
        <FormField label={t('editor_opening_swing', 'Swing')} className={styles.field}>
          <select
            className={styles.select}
            value={opening.swingDirection}
            onChange={(e) => onPatch({ swingDirection: e.target.value })}
          >
            {SWING_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {t(`editor_swing_${direction}`, direction)}
              </option>
            ))}
          </select>
        </FormField>
      )}

      <button type="button" className={styles.actionDanger} onClick={onRemove}>
        <Trash2 size={15} aria-hidden="true" /> {t('editor_opening_remove', 'Remove opening')}
      </button>
    </li>
  );
}
