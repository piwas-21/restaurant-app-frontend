'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import type { TableRenderState } from '@/components/floor-plan/sceneTypes';
import { useServerFloorSnapshot } from '@/hooks/serverWorkspace/useServerFloorSnapshot';
import { useServerFloorListScroll } from '@/hooks/serverWorkspace/useServerFloorListScroll';
import { useServerFloorNarrow } from '@/hooks/serverWorkspace/useServerFloorNarrow';
import { useServerFloorViewState } from '@/hooks/serverWorkspace/useServerFloorViewState';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import { isKnownServerFloorTableState, toFloorPlanShape } from '@/types/serverWorkspace';
import ServerFloorTableCard from './ServerFloorTableCard';
import ServerFloorMapPanel from './ServerFloorMapPanel';
import ServerFloorWorkspaceToolbar from './ServerFloorWorkspaceToolbar';
import styles from './ServerFloorWorkspace.module.css';

const EMPTY_TABLES: ServerFloorTable[] = [];
const EMPTY_ZONES: FloorPlanDocument[] = [];

function renderState(table: ServerFloorTable, selected: boolean): TableRenderState {
  if (selected) return 'selected';
  if (!isKnownServerFloorTableState(table.state)) return 'unavailable';
  if (table.state === 'Reserved') return 'booked';
  if (table.state === 'Open' || table.state === 'Ready' || table.state === 'Ambiguous') return 'occupied';
  if (table.state === 'Inactive') return 'dim';
  return 'available';
}

function geometryFor(table: ServerFloorTable): FloorPlanTableGeometry {
  return {
    id: table.tableId,
    tableNumber: table.tableLabel,
    maxGuests: table.maxGuests,
    isActive: table.isActive,
    isOutdoor: table.isOutdoor,
    positionX: table.positionX,
    positionY: table.positionY,
    width: table.width,
    height: table.height,
    shape: toFloorPlanShape(table.shape),
    rotation: table.rotation,
  };
}

function statusLabelKey(state: string): string {
  switch (state) {
    case 'Ready':
      return 'server.status_ready';
    case 'Reserved':
      return 'server.status_reserved';
    case 'Open':
      return 'server.status_occupied';
    case 'Inactive':
      return 'server.status_closed';
    case 'Ambiguous':
      return 'cashier.tables.status_legacy';
    case 'Available':
      return 'server.status_available';
    default:
      return 'unavailable';
  }
}

function tableLabel(table: ServerFloorTable, t: TFunction) {
  const statusKey = statusLabelKey(table.state);
  const statusFallback = isKnownServerFloorTableState(table.state) ? table.state : t('unavailable', 'Unavailable');
  return t('table_marker_aria', 'Table {{number}}, {{seats}} seats, {{status}}', {
    number: table.tableLabel,
    seats: table.maxGuests,
    status: t(statusKey, statusFallback),
  });
}

export default function ServerFloorWorkspace() {
  const { t } = useTranslation();
  const router = useRouter();
  const floor = useServerFloorSnapshot();
  const viewState = useServerFloorViewState();
  const { view, zoneId, scrollTop, setView, setZoneId, setScrollTop } = viewState;
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const isNarrow = useServerFloorNarrow();
  const listRef = useServerFloorListScroll(view, scrollTop, setScrollTop);

  const zones = floor.snapshot?.zones ?? EMPTY_ZONES;
  const tables = floor.snapshot?.tables ?? EMPTY_TABLES;
  const resolvedZoneId = zoneId && zones.some((zone) => zone.id === zoneId) ? zoneId : null;
  const activeZoneId = resolvedZoneId ?? zones[0]?.id ?? null;
  const selectedZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0] ?? null;
  const visibleTables = useMemo(
    () => (resolvedZoneId ? tables.filter((table) => table.zoneId === resolvedZoneId) : tables),
    [tables, resolvedZoneId],
  );
  const mapDocuments = useMemo<FloorPlanDocument[]>(() => {
    const sourceZones = resolvedZoneId ? (selectedZone ? [selectedZone] : []) : zones;
    return sourceZones.map((zone) => ({
      ...zone,
      tables: tables.filter((table) => table.zoneId === zone.id).map(geometryFor),
    }));
  }, [resolvedZoneId, selectedZone, tables, zones]);
  const mapTables = useMemo(
    () =>
      resolvedZoneId
        ? visibleTables
        : tables.filter((table) => table.zoneId != null && zones.some((zone) => zone.id === table.zoneId)),
    [resolvedZoneId, tables, visibleTables, zones],
  );
  const mapHasTables = mapDocuments.some((document) => document.tables.length > 0);
  const selectedTable = tables.find((table) => table.tableId === selectedTableId) ?? null;
  const selectedTableForView =
    selectedTable && (!resolvedZoneId || selectedTable.zoneId === resolvedZoneId) ? selectedTable : null;
  const states = useMemo<Record<string, TableRenderState>>(
    () =>
      Object.fromEntries(
        mapTables.map((table) => [table.tableId, renderState(table, table.tableId === selectedTableId)]),
      ),
    [mapTables, selectedTableId],
  );

  useEffect(() => {
    if (zoneId && !zones.some((zone) => zone.id === zoneId)) setZoneId(null);
  }, [setZoneId, zoneId, zones]);

  useEffect(() => {
    if (!selectedTable) {
      if (selectedTableId) setSelectedTableId(null);
      return;
    }
    if (resolvedZoneId && selectedTable.zoneId !== resolvedZoneId) setSelectedTableId(null);
  }, [resolvedZoneId, selectedTable, selectedTableId]);

  const selectTable = useCallback(
    (tableId: string) => {
      const table = tables.find((candidate) => candidate.tableId === tableId);
      if (!table || !isKnownServerFloorTableState(table.state)) return;
      setSelectedTableId(tableId);
      if (isNarrow) router.push(`/server/tables/${encodeURIComponent(tableId)}`);
    },
    [isNarrow, router, tables],
  );
  const tableById = useMemo(() => new Map(tables.map((table) => [table.tableId, table])), [tables]);
  const formatTableLabel = useCallback(
    (geometry: FloorPlanTableGeometry) => {
      const table = tableById.get(geometry.id);
      return table ? tableLabel(table, t) : geometry.tableNumber;
    },
    [t, tableById],
  );
  const errorText =
    floor.error === 'floor_plan_load_error'
      ? t('floor_plan_load_error', 'The floor plan could not load.')
      : floor.error;

  const navItems = [
    { href: '/server/floor', label: t('server.table', 'Floor'), active: true },
    { href: '/server/takeaway', label: t('server.takeaway.link') },
  ];

  return (
    <StaffWorkspaceShell
      navItems={navItems}
      connectionState={floor.connectionState}
      lastConfirmed={floor.snapshot?.serverTime}
      onRetryConnection={() => void floor.refresh()}
      className={styles.shell}
    >
      <div className={styles.workspace} data-testid="server-floor-workspace">
        <header className={styles.heading}>
          <div>
            <h1>{t('staff.workspace', 'Staff workspace')}</h1>
            <p>{t('server.all_active_orders', 'All Active Orders')}</p>
          </div>
          <Link className={styles.control} href="/server/takeaway">
            {t('server.takeaway.link')}
          </Link>
        </header>

        {floor.isStale && (
          <p className={styles.staleNotice} role="status">
            {t('server.status_stale', 'Stale data')} · {t('server.last_confirmed', 'Last confirmed')}
          </p>
        )}

        <ServerFloorWorkspaceToolbar
          view={view}
          zoneId={resolvedZoneId}
          zones={zones}
          connectionState={floor.connectionState}
          lastConfirmed={floor.snapshot?.serverTime}
          onRetry={() => void floor.refresh()}
          onViewChange={setView}
          onZoneChange={setZoneId}
        />

        {!floor.snapshot && floor.isLoading && <div className={styles.statePanel}>{t('loading', 'Loading')}</div>}
        {!floor.snapshot && !floor.isLoading && (
          <div className={styles.statePanel} role="alert">
            <p>{errorText ?? t('floor_plan_load_error', 'The floor plan could not load.')}</p>
            <button type="button" className={styles.retry} onClick={() => void floor.refresh()}>
              {t('retry', 'Retry')}
            </button>
          </div>
        )}
        {floor.snapshot && tables.length === 0 && (
          <div className={styles.statePanel}>{t('no_tables_here', 'No tables in this area right now.')}</div>
        )}

        {floor.snapshot && tables.length > 0 && view === 'map' && !mapHasTables && (
          <div className={styles.statePanel}>{t('no_tables_here', 'No tables in this area right now.')}</div>
        )}

        {floor.snapshot && mapHasTables && view === 'map' && (
          <ServerFloorMapPanel
            documents={mapDocuments}
            states={states}
            selectedTable={selectedTableForView}
            formatTableLabel={formatTableLabel}
            onSelectTable={selectTable}
          />
        )}

        {floor.snapshot && tables.length > 0 && view === 'list' && (
          <section ref={listRef} className={styles.listPanel} aria-label={t('list', 'List')}>
            <div className={styles.tableList}>
              {visibleTables.length === 0 ? (
                <p className={styles.empty}>{t('no_tables_here', 'No tables in this area right now.')}</p>
              ) : (
                visibleTables.map((table) => (
                  <ServerFloorTableCard
                    key={table.tableId}
                    table={table}
                    selected={table.tableId === selectedTableId}
                    onSelect={selectTable}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}
