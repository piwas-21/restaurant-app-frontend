'use client';

import { useTranslation } from 'react-i18next';
import ConnectionStateBanner from '@/components/design-system/ConnectionStateBanner';
import type { ConnectionState } from '@/lib/operationalStatus';
import type { ServerFloorView } from '@/hooks/serverWorkspace/useServerFloorViewState';
import type { FloorPlanDocument } from '@/types/floorPlan';
import styles from './ServerFloorWorkspace.module.css';
import toolbarStyles from './ServerFloorWorkspaceToolbar.module.css';

interface ServerFloorWorkspaceToolbarProps {
  view: ServerFloorView;
  zoneId: string | null;
  zones: FloorPlanDocument[];
  connectionState: ConnectionState;
  lastConfirmed?: string;
  searchQuery: string;
  onRetry: () => void;
  onViewChange: (view: ServerFloorView) => void;
  onZoneChange: (zoneId: string | null) => void;
  onSearchChange: (query: string) => void;
}

export default function ServerFloorWorkspaceToolbar({
  view,
  zoneId,
  zones,
  connectionState,
  lastConfirmed,
  searchQuery,
  onRetry,
  onViewChange,
  onZoneChange,
  onSearchChange,
}: Readonly<ServerFloorWorkspaceToolbarProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar} aria-label={t('floor_plan', 'Floor plan')}>
      <div className={styles.viewToggle} role="group" aria-label={t('cashier.tables.view_toggle', 'Table view')}>
        <button
          type="button"
          className={styles.control}
          aria-pressed={view === 'map'}
          onClick={() => onViewChange('map')}
        >
          {t('map', 'Map')}
        </button>
        <button
          type="button"
          className={styles.control}
          aria-pressed={view === 'list'}
          onClick={() => onViewChange('list')}
        >
          {t('list', 'List')}
        </button>
      </div>
      <div className={styles.zoneList} role="group" aria-label={t('floor_plan', 'Floor plan')}>
        <button
          type="button"
          className={styles.control}
          aria-pressed={zoneId === null}
          data-selected={zoneId === null}
          onClick={() => onZoneChange(null)}
        >
          {t('everywhere', 'Everywhere')}
        </button>
        {zones.map((zone) => (
          <button
            type="button"
            className={styles.control}
            aria-pressed={zoneId === zone.id}
            data-selected={zoneId === zone.id}
            key={zone.id}
            onClick={() => onZoneChange(zone.id)}
          >
            {zone.name}
          </button>
        ))}
      </div>
      <div className={styles.toolbarActions}>
        <label className={toolbarStyles.searchField}>
          <span className={toolbarStyles.srOnly}>{t('server.search_tables', 'Search tables')}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('server.search_tables', 'Search tables')}
            aria-label={t('server.search_tables', 'Search tables')}
          />
        </label>
        <ConnectionStateBanner state={connectionState} lastConfirmed={lastConfirmed} onRetry={onRetry} />
      </div>
      <ul className={styles.legend} aria-label={t('server.table_state_legend', 'Table state legend')}>
        {[
          ['available', t('server.status_available', 'Available')],
          ['occupied', t('server.status_occupied', 'Open')],
          ['ready', t('server.status_ready', 'Ready')],
          ['reserved', t('server.status_reserved', 'Reserved')],
          ['review', t('cashier.tables.status_legacy', 'Needs review')],
          ['unavailable', t('unavailable', 'Unavailable')],
        ].map(([state, label]) => (
          <li key={state}>
            <span className={styles.legendSwatch} data-state={state} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
