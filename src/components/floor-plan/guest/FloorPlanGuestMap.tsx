'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FloorPlanScene from '../FloorPlanScene';
import type { TableRenderState } from '../sceneTypes';
import type { FloorPlanTableGeometry } from '@/types/floorPlan';
import { useFloorPlanDocument } from '@/hooks/floorPlan/useFloorPlanDocument';
import { usePlanViewport } from '@/hooks/floorPlan/usePlanViewport';
import { useGuestHover } from '@/hooks/floorPlan/useGuestHover';
import { planZones } from '@/lib/floorPlan/zones';
import { statesById, tableInfos } from './guestMapState';
import FloorPlanZoneChips, { type GuestMapView } from './FloorPlanZoneChips';
import FloorPlanTableList from './FloorPlanTableList';
import FloorPlanMapControls from './FloorPlanMapControls';
import FloorPlanHoverCard from './FloorPlanHoverCard';
import styles from './FloorPlanGuestMap.module.css';

/** Accessible status wording per render state (key + English fallback). */
const STATUS_LABEL: Record<TableRenderState, readonly [string, string]> = {
  available: ['available', 'Available'],
  dim: ['available', 'Available'],
  selected: ['selected', 'Selected'],
  booked: ['booked', 'Booked'],
  small: ['table_too_small', 'too small for your party'],
};

interface FloorPlanGuestMapProps {
  /** The template's floor-plan skin class (craft / classic scene scalars). */
  skinClassName?: string;
  selectedTableIds: string[];
  bookedTableIds: string[];
  numberOfGuests: number;
  /** Select a table by id; the page maps it to the booking docket. */
  onSelectTable: (id: string) => void;
}

/** Move keyboard focus to the next/previous table in the roving group. */
function focusAdjacentTable(stage: HTMLElement | null, direction: 1 | -1) {
  if (!stage) {
    return;
  }
  const tables = [...stage.querySelectorAll<SVGGElement>('[data-table-id][tabindex]')];
  if (tables.length === 0) {
    return;
  }
  const current = tables.indexOf(document.activeElement as SVGGElement);
  const next = tables[(current + direction + tables.length) % tables.length];
  next?.focus();
}

export default function FloorPlanGuestMap({
  skinClassName,
  selectedTableIds,
  bookedTableIds,
  numberOfGuests,
  onSelectTable,
}: Readonly<FloorPlanGuestMapProps>) {
  const { t } = useTranslation();
  const { document: plan, status, retry } = useFloorPlanDocument();
  const [view, setView] = useState<GuestMapView>('map');
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const viewport = usePlanViewport(plan?.widthMeters ?? 12, plan?.heightMeters ?? 8, status === 'ready');
  const hover = useGuestHover(viewport.stageRef);

  const activeTables = useMemo(() => (plan ? plan.tables.filter((table) => table.isActive) : []), [plan]);
  const infos = useMemo(
    () =>
      plan
        ? tableInfos(activeTables, {
            walls: plan.walls,
            selectedIds: selectedTableIds,
            bookedIds: bookedTableIds,
            party: numberOfGuests,
            zoneFilter,
          })
        : [],
    [plan, activeTables, selectedTableIds, bookedTableIds, numberOfGuests, zoneFilter],
  );
  const zones = useMemo(() => (plan ? planZones(activeTables, plan.walls) : []), [plan, activeTables]);
  const states = useMemo<Record<string, TableRenderState>>(() => statesById(infos), [infos]);
  const hovered = infos.find((info) => info.table.id === hover.hoverId) ?? null;

  const formatTableLabel = useCallback(
    (table: FloorPlanTableGeometry, state: TableRenderState) =>
      t('table_marker_aria', 'Table {{number}}, {{seats}} seats, {{status}}', {
        number: table.tableNumber,
        seats: table.maxGuests,
        status: t(...STATUS_LABEL[state]),
      }),
    [t],
  );

  // Esc dismisses the hover card without moving the pointer (SC 1.4.13).
  const { hoverId, clear: clearHover } = hover;
  useEffect(() => {
    if (!hoverId) {
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearHover();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hoverId, clearHover]);

  // Arrow-key roving between tables. Attached natively (not a JSX handler) so
  // the stage stays a plain container rather than a static element carrying
  // keyboard listeners (jsx-a11y S6847/S6848); the labelled SVG group + its
  // focusable table buttons carry the semantics, and the List is the linear
  // screen-reader path.
  const { stageRef } = viewport;
  useEffect(() => {
    const el = stageRef.current;
    if (!el || status !== 'ready' || view !== 'map') {
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusAdjacentTable(el, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusAdjacentTable(el, -1);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [stageRef, status, view]);

  if (status === 'loading') {
    return <div className={styles.stateMessage}>{t('loading', 'Loading…')}</div>;
  }
  if (status === 'error' || !plan) {
    return (
      <div className={styles.stateMessage} role="alert">
        {t('floor_plan_load_error', 'The floor plan could not load.')}{' '}
        <button type="button" className={styles.retry} onClick={retry}>
          {t('retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.map}>
      <FloorPlanZoneChips
        view={view}
        onViewChange={setView}
        zones={zones}
        zoneFilter={zoneFilter}
        onZoneChange={setZoneFilter}
      />
      {view === 'map' ? (
        <>
          {/* A plain pan/hover surface — pointer handlers only (keyboard roving
              is attached natively above). The labelled SVG group inside carries
              the region semantics. */}
          <div
            ref={viewport.stageRef}
            className={styles.stage}
            onPointerDown={viewport.stageHandlers.onPointerDown}
            onPointerMove={(e) => {
              viewport.stageHandlers.onPointerMove(e);
              hover.onStagePointerMove(e);
            }}
            onPointerUp={viewport.stageHandlers.onPointerUp}
            onPointerCancel={viewport.stageHandlers.onPointerCancel}
            onPointerLeave={hover.onStagePointerLeave}
          >
            <FloorPlanScene
              document={{ ...plan, tables: activeTables }}
              skinClassName={skinClassName}
              tableStates={states}
              viewBox={viewport.viewBox}
              onSelectTable={onSelectTable}
              formatTableLabel={formatTableLabel}
              ariaLabel={t('restaurant_floor_plan', 'Restaurant floor plan')}
            />
            {hovered && (
              <FloorPlanHoverCard
                info={hovered}
                party={numberOfGuests}
                position={hover.position}
                onClose={clearHover}
                onPointerEnter={hover.cardHandlers.onPointerEnter}
                onPointerLeave={hover.cardHandlers.onPointerLeave}
              />
            )}
          </div>
          <FloorPlanMapControls
            party={numberOfGuests}
            onZoomIn={viewport.zoomIn}
            onZoomOut={viewport.zoomOut}
            onFit={viewport.fit}
          />
        </>
      ) : (
        <FloorPlanTableList
          infos={infos}
          party={numberOfGuests}
          zoneFilter={zoneFilter}
          onSelectTable={onSelectTable}
        />
      )}
    </div>
  );
}
