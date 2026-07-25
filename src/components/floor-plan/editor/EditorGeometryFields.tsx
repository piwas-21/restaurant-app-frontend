'use client';

import { useTranslation } from 'react-i18next';
import { snapAngle } from '@/lib/floorPlan/snapping';
import type { MovableGeometry } from '@/lib/floorPlan/movable';
import EditorNumberField from './EditorNumberField';
import EditorRotationControls from './EditorRotationControls';
import styles from './EditorInspector.module.css';

/**
 * Exact, no-drag geometry for whatever is selected (FLOOR-PLAN-REVAMP §4.3) —
 * numeric X/Y/W/H plus rotation as a degree field, eight preset chips and ±45°
 * steppers. This is the SC 2.5.7 equivalent of every canvas gesture, and it is
 * shared by the table and item panels: a plant's position is edited by the same
 * control a table's is, because they are the same operation on the same document.
 */
interface EditorGeometryFieldsProps {
  rect: MovableGeometry;
  plan: { widthMeters: number; heightMeters: number };
  /** The server's floor for a footprint (0.1 m for both tables and items). */
  minSizeMeters: number;
  onPatch: (patch: Partial<MovableGeometry>) => void;
}

export default function EditorGeometryFields({
  rect,
  plan,
  minSizeMeters,
  onPatch,
}: Readonly<EditorGeometryFieldsProps>) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.grid}>
        <EditorNumberField
          label={t('editor_x', 'X (m)')}
          value={rect.x}
          min={0}
          max={plan.widthMeters}
          onCommit={(v) => onPatch({ x: v })}
        />
        <EditorNumberField
          label={t('editor_y', 'Y (m)')}
          value={rect.y}
          min={0}
          max={plan.heightMeters}
          onCommit={(v) => onPatch({ y: v })}
        />
        <EditorNumberField
          label={t('editor_width', 'Width (m)')}
          value={rect.widthMeters}
          min={minSizeMeters}
          max={plan.widthMeters}
          onCommit={(v) => onPatch({ widthMeters: v })}
        />
        <EditorNumberField
          label={t('editor_height', 'Height (m)')}
          value={rect.heightMeters}
          min={minSizeMeters}
          max={plan.heightMeters}
          onCommit={(v) => onPatch({ heightMeters: v })}
        />
      </div>

      <EditorNumberField
        label={t('editor_rotation', 'Rotation (°)')}
        value={rect.rotationDegrees}
        step={1}
        onCommit={(v) => onPatch({ rotationDegrees: snapAngle(v, 1) })}
      />
      <EditorRotationControls rotation={rect.rotationDegrees} onSet={(deg) => onPatch({ rotationDegrees: deg })} />
    </>
  );
}
