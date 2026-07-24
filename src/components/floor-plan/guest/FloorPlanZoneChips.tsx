'use client';

import { useTranslation } from 'react-i18next';
import styles from './FloorPlanZoneChips.module.css';

export type GuestMapView = 'map' | 'list';

/**
 * The Map | List segmented control plus the zone chips (FLOOR-PLAN-REVAMP §4.2).
 * Selecting a zone dims non-matching tables rather than hiding them, so the room
 * stays legible. Zone names are data (room names), not translated. The List is
 * the same data and the screen-reader path on every device.
 */
interface FloorPlanZoneChipsProps {
  view: GuestMapView;
  onViewChange: (view: GuestMapView) => void;
  zones: string[];
  zoneFilter: string | null;
  onZoneChange: (zone: string | null) => void;
}

export default function FloorPlanZoneChips({
  view,
  onViewChange,
  zones,
  zoneFilter,
  onZoneChange,
}: Readonly<FloorPlanZoneChipsProps>) {
  const { t } = useTranslation();
  return (
    <div className={styles.chips}>
      <div className={styles.viewToggle} role="group" aria-label={t('floor_plan_view', 'View')}>
        <button type="button" className={styles.chip} aria-pressed={view === 'map'} onClick={() => onViewChange('map')}>
          {t('map', 'Map')}
        </button>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={view === 'list'}
          onClick={() => onViewChange('list')}
        >
          {t('list', 'List')}
        </button>
      </div>
      {zones.length > 0 && (
        <div className={styles.zoneChips} role="group" aria-label={t('zones', 'Zones')}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={zoneFilter === null}
            onClick={() => onZoneChange(null)}
          >
            {t('everywhere', 'Everywhere')}
          </button>
          {zones.map((zone) => (
            <button
              key={zone}
              type="button"
              className={styles.chip}
              aria-pressed={zoneFilter === zone}
              onClick={() => onZoneChange(zone)}
            >
              {zone}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
