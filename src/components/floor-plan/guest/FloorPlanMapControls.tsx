'use client';

import { useTranslation } from 'react-i18next';
import styles from './FloorPlanMapControls.module.css';

/**
 * The legend and zoom controls under the map (FLOOR-PLAN-REVAMP §4.4). The zoom
 * buttons sit beside the legend, never floating over the plan — a floating
 * control lands on the tables you are trying to read at exactly the width where
 * reading is hardest. The buttons mean zoom never *requires* a gesture (SC
 * 2.5.7).
 */
interface FloorPlanMapControlsProps {
  party: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export default function FloorPlanMapControls({
  party,
  onZoomIn,
  onZoomOut,
  onFit,
}: Readonly<FloorPlanMapControlsProps>) {
  const { t } = useTranslation();
  return (
    <div className={styles.mapTools}>
      <div className={styles.legend}>
        <span>
          <i className={styles.swatch} />
          {t('available', 'Available')}
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.swatchSelected}`} />
          {t('selected', 'Selected')}
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.swatchBooked}`} />
          {t('booked', 'Booked')}
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.swatchSmall}`} />
          {t('too_small_for_party', 'Too small for {{party}}', { party })}
        </span>
      </div>
      <div className={styles.zoomer}>
        <button type="button" onClick={onZoomOut} aria-label={t('zoom_out', 'Zoom out')}>
          −
        </button>
        <button type="button" onClick={onFit} aria-label={t('fit_plan', 'Fit the plan')}>
          ⤢
        </button>
        <button type="button" onClick={onZoomIn} aria-label={t('zoom_in', 'Zoom in')}>
          +
        </button>
      </div>
    </div>
  );
}
