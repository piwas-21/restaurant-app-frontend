'use client';

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { FloorPlanOpening, FloorPlanOpeningKind, FloorPlanWall } from '@/types/floorPlan';
import { wallSegments } from '@/lib/floorPlan/walls';
import { OPENING_KINDS, canAddOpening, longestSegmentIndex } from '@/lib/floorPlan/wallOpenings';
import EditorOpeningRow from './EditorOpeningRow';
import styles from './EditorInspector.module.css';

/**
 * The selected wall's doors, windows and gaps (FLOOR-PLAN-REVAMP §4.3). They are
 * **not palette objects**: an opening belongs to a wall segment, so it is created
 * from the wall that will hold it and can never be dragged off it.
 *
 * A new opening lands centred on the **longest side** — the one most likely to be
 * the front of the room, and always long enough to hold it — and is then moved
 * from its own row. That beats asking for a side before the admin has seen one.
 */
interface EditorOpeningsPanelProps {
  wall: FloorPlanWall;
  onAdd: (segmentIndex: number, kind: FloorPlanOpeningKind) => void;
  onPatch: (openingId: string, patch: Partial<FloorPlanOpening>) => void;
  onRemove: (openingId: string) => void;
}

export default function EditorOpeningsPanel({ wall, onAdd, onPatch, onRemove }: Readonly<EditorOpeningsPanelProps>) {
  const { t } = useTranslation();
  const segments = wallSegments(wall);
  const canAdd = canAddOpening(wall) && segments.length > 0;
  const target = longestSegmentIndex(wall);

  return (
    <>
      <h3 className={styles.subheading}>{t('editor_openings', 'Doors & windows')}</h3>

      <div className={styles.actions}>
        {OPENING_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.action}
            disabled={!canAdd}
            onClick={() => onAdd(target, kind)}
          >
            <Plus size={15} aria-hidden="true" /> {t(`editor_opening_${kind}`, kind)}
          </button>
        ))}
      </div>

      {wall.openings.length === 0 && (
        <p className={styles.hint}>
          {t('editor_openings_empty', 'No openings yet. Add one, then choose which side it sits on.')}
        </p>
      )}

      <ul className={styles.openings}>
        {wall.openings.map((opening, index) => {
          const id = opening.id;
          return (
            <EditorOpeningRow
              // An opening always has an id here — stored ones come from the
              // server, and the editor mints a local one the moment it creates.
              key={id ?? `${opening.segmentIndex}-${opening.offsetMeters}-${index}`}
              opening={opening}
              segments={segments}
              onPatch={(patch) => id && onPatch(id, patch)}
              onRemove={() => id && onRemove(id)}
            />
          );
        })}
      </ul>
    </>
  );
}
