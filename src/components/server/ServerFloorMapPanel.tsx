'use client';

import { useTranslation } from 'react-i18next';
import FloorPlanScene from '@/components/floor-plan/FloorPlanScene';
import type { TableRenderState } from '@/components/floor-plan/sceneTypes';
import { usePlanViewport } from '@/hooks/floorPlan/usePlanViewport';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import ServerFloorTableCard from './ServerFloorTableCard';
import workspaceStyles from './ServerFloorWorkspace.module.css';
import styles from './ServerFloorMap.module.css';
import sceneSkin from '@active-template/floor-plan/FloorPlanScene.module.css';

interface ServerFloorMapPanelProps {
  documents: readonly FloorPlanDocument[];
  states: Record<string, TableRenderState>;
  selectedTable: ServerFloorTable | null;
  formatTableLabel: (table: FloorPlanTableGeometry) => string;
  onSelectTable: (tableId: string) => void;
}

interface ZoneMapProps {
  document: FloorPlanDocument;
  states: Record<string, TableRenderState>;
  formatTableLabel: (table: FloorPlanTableGeometry) => string;
  onSelectTable: (tableId: string) => void;
}

function ZoneMap({ document, states, formatTableLabel, onSelectTable }: Readonly<ZoneMapProps>) {
  const { t } = useTranslation();
  const viewport = usePlanViewport(document.widthMeters, document.heightMeters, true);

  return (
    <section className={styles.zoneMap} aria-label={document.name}>
      <h2 className={styles.zoneTitle}>{document.name}</h2>
      <div
        ref={viewport.stageRef}
        className={styles.stage}
        onPointerDown={viewport.stageHandlers.onPointerDown}
        onPointerMove={viewport.stageHandlers.onPointerMove}
        onPointerUp={viewport.stageHandlers.onPointerUp}
        onPointerCancel={viewport.stageHandlers.onPointerCancel}
      >
        <FloorPlanScene
          document={document}
          skinClassName={sceneSkin.skin}
          tableStates={states}
          viewBox={viewport.viewBox}
          onSelectTable={(id) => onSelectTable(id)}
          formatTableLabel={formatTableLabel}
          ariaLabel={t('restaurant_floor_plan', 'Restaurant floor plan')}
        />
      </div>
      <div className={styles.mapControls} aria-label={t('floor_plan', 'Floor plan')}>
        <button
          type="button"
          className={workspaceStyles.control}
          onClick={viewport.zoomOut}
          aria-label={t('zoom_out', 'Zoom out')}
        >
          −
        </button>
        <button
          type="button"
          className={workspaceStyles.control}
          onClick={viewport.fit}
          aria-label={t('fit_plan', 'Fit the plan')}
        >
          ⤢
        </button>
        <button
          type="button"
          className={workspaceStyles.control}
          onClick={viewport.zoomIn}
          aria-label={t('zoom_in', 'Zoom in')}
        >
          +
        </button>
      </div>
    </section>
  );
}

export default function ServerFloorMapPanel({
  documents,
  states,
  selectedTable,
  formatTableLabel,
  onSelectTable,
}: Readonly<ServerFloorMapPanelProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.workspaceBody} data-has-selection={selectedTable ? 'true' : 'false'}>
      <section className={styles.spatialPanel} aria-label={t('restaurant_floor_plan', 'Restaurant floor plan')}>
        <div className={styles.zoneMaps}>
          {documents.map((document) => (
            <ZoneMap
              key={document.id}
              document={document}
              states={states}
              formatTableLabel={formatTableLabel}
              onSelectTable={onSelectTable}
            />
          ))}
        </div>
      </section>
      <aside className={styles.detailPanel} aria-label={t('server.table_info', 'Table Information')}>
        {selectedTable ? (
          <ServerFloorTableCard table={selectedTable} selected onSelect={onSelectTable} />
        ) : (
          <p className={workspaceStyles.empty}>{t('select', 'Select')}</p>
        )}
      </aside>
    </div>
  );
}
