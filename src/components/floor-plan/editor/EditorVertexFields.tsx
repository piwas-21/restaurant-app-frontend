'use client';

import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { FloorPlanDocument, FloorPlanWall } from '@/types/floorPlan';
import { canRemoveVertex } from '@/lib/floorPlan/wallEditing';
import EditorNumberField from './EditorNumberField';
import styles from './EditorInspector.module.css';

/**
 * The picked corner's exact position (FLOOR-PLAN-REVAMP §4.3) — the no-drag
 * equivalent of the canvas grips, and the only route to a corner at all for
 * anyone not using a pointer (SC 2.5.7). A corner picker sits above the fields
 * because there is nothing else to select one with from the keyboard.
 *
 * Removing the last corner a wall can spare is refused rather than hidden: the
 * button says why it is disabled, instead of silently doing nothing.
 */
interface EditorVertexFieldsProps {
  wall: FloorPlanWall;
  plan: Pick<FloorPlanDocument, 'widthMeters' | 'heightMeters'>;
  selectedVertex: number | null;
  onSelectVertex: (index: number | null) => void;
  onMove: (index: number, x: number, y: number) => void;
  onRemove: (index: number) => void;
}

export default function EditorVertexFields({
  wall,
  plan,
  selectedVertex,
  onSelectVertex,
  onMove,
  onRemove,
}: Readonly<EditorVertexFieldsProps>) {
  const { t } = useTranslation();
  const point = selectedVertex === null ? null : wall.points[selectedVertex];
  const removable = canRemoveVertex(wall);

  return (
    <>
      <h3 className={styles.subheading}>{t('editor_wall_corners', 'Corners')}</h3>

      <FormField label={t('editor_wall_corner', 'Corner')} className={styles.field}>
        <select
          className={styles.select}
          value={selectedVertex ?? ''}
          onChange={(e) => onSelectVertex(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">{t('editor_wall_corner_none', 'None selected')}</option>
          {wall.points.map((p, index) => (
            <option key={`${p.x},${p.y},${index}`} value={index}>
              {t('editor_wall_corner_n', 'Corner {{n}}', { n: index + 1 })}
            </option>
          ))}
        </select>
      </FormField>

      {point && selectedVertex !== null && (
        <>
          <div className={styles.grid}>
            <EditorNumberField
              label={t('editor_x', 'X (m)')}
              value={point.x}
              min={0}
              max={plan.widthMeters}
              onCommit={(v) => onMove(selectedVertex, v, point.y)}
            />
            <EditorNumberField
              label={t('editor_y', 'Y (m)')}
              value={point.y}
              min={0}
              max={plan.heightMeters}
              onCommit={(v) => onMove(selectedVertex, point.x, v)}
            />
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionDanger}
              disabled={!removable}
              onClick={() => onRemove(selectedVertex)}
            >
              <Trash2 size={15} aria-hidden="true" /> {t('editor_wall_corner_remove', 'Remove corner')}
            </button>
          </div>
          {!removable && (
            <p className={styles.hint}>
              {t('editor_wall_corner_min', 'A wall needs at least two corners; a room needs three.')}
            </p>
          )}
        </>
      )}

      {!point && (
        <p className={styles.hint}>
          {t('editor_wall_corner_hint', 'Drag a corner dot on the plan, or pick one here to type its position.')}
        </p>
      )}
    </>
  );
}
