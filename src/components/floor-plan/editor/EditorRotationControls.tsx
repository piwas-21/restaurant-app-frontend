'use client';

import { useTranslation } from 'react-i18next';
import { RotateCcw, RotateCw } from 'lucide-react';
import { snapAngle } from '@/lib/floorPlan/snapping';
import styles from './EditorInspector.module.css';

/**
 * Rotation controls for the selected table (FLOOR-PLAN-REVAMP §4.3 — "the
 * feature that failed before"). The inspector is the primary, always-exact
 * control: eight preset chips, plus ↺/↻ 45° steppers. Works on touch and by
 * keyboard, so rotation never depends on a canvas drag (SC 2.5.7).
 */
const PRESETS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

interface EditorRotationControlsProps {
  rotation: number;
  onSet: (deg: number) => void;
}

export default function EditorRotationControls({ rotation, onSet }: Readonly<EditorRotationControlsProps>) {
  const { t } = useTranslation();
  const current = Math.round(snapAngle(rotation, 1));
  return (
    <div className={styles.rotation}>
      <div className={styles.presets}>
        {PRESETS.map((deg) => (
          <button
            key={deg}
            type="button"
            className={styles.chip}
            aria-pressed={current === deg}
            onClick={() => onSet(deg)}
          >
            {deg}°
          </button>
        ))}
      </div>
      <div className={styles.steppers}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('editor_rotate_ccw', 'Rotate 45° counter-clockwise')}
          onClick={() => onSet(snapAngle(rotation - 45, 1))}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('editor_rotate_cw', 'Rotate 45° clockwise')}
          onClick={() => onSet(snapAngle(rotation + 45, 1))}
        >
          <RotateCw size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
