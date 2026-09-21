'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import type { TableRenderState } from '@/components/floor-plan/sceneTypes';
import { useServerFloorSnapshot } from '@/hooks/serverWorkspace/useServerFloorSnapshot';
import { useServerFloorListScroll } from '@/hooks/serverWorkspace/useServerFloorListScroll';
import { useServerFloorNarrow } from '@/hooks/serverWorkspace/useServerFloorNarrow';
import { useServerFloorViewState } from '@/hooks/serverWorkspace/useServerFloorViewState';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import { isKnownServerFloorTableState } from '@/types/serverWorkspace';
import ServerFloorTableCard from './ServerFloorTableCard';
import ServerFloorMapPanel from './ServerFloorMapPanel';
import { geometryFor, renderState, tableLabel } from './serverFloorPresentation';
import ServerFloorWorkspaceToolbar from './ServerFloorWorkspaceToolbar';
import styles from './ServerFloorWorkspace.module.css';

const EMPTY_TABLES: ServerFloorTable[] = [];
const EMPTY_ZONES: FloorPlanDocument[] = [];

export default function ServerFloorWorkspace() {
  const { t } = useTranslation();
  const router = useRouter();
  const floor = useServerFloorSnapshot();
  const viewState = useServerFloorViewState();
  const { view, zoneId, scrollTop, hydrated, hasStoredPreference, setView, setZoneId, setScrollTop } = viewState;
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isNarrow = useServerFloorNarrow();
  const effectiveView = hydrated && isNarrow === true && !hasStoredPreference ? 'list' : view;
  const listRef = useServerFloorListScroll(effectiveView, scrollTop, setScrollTop);

  useEffect(() => {
    if (hydrated && isNarrow === true && !hasStoredPreference && view !== 'list') setView('list');
  }, [hasStoredPreference, hydrated, isNarrow, setView, view]);

  const zones = floor.snapshot?.zones ?? EMPTY_ZONES;
  const tables = floor.snapshot?.tables ?? EMPTY_TABLES;
  const resolvedZoneId = zoneId && zones.some((zone) => zone.id === zoneId) ? zoneId : null;
  const activeZoneId = resolvedZoneId ?? zones[0]?.id ?? null;
  const selectedZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0] ?? null;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleTables = useMemo(() => {
    const zoneTables = resolvedZoneId ? tables.filter((table) => table.zoneId === resolvedZoneId) : tables;
    if (!normalizedSearchQuery) return zoneTables;
    return zoneTables.filter((table) =>
      [table.tableLabel, table.zoneName ?? ''].some((value) => value.toLowerCase().includes(normalizedSearchQuery)),
    );
  }, [normalizedSearchQuery, tables, resolvedZoneId]);
  const mapDocuments = useMemo<FloorPlanDocument[]>(() => {
    const sourceZones = resolvedZoneId
      ? selectedZone
        ? [selectedZone]
        : []
      : zones.filter((zone) => visibleTables.some((table) => table.zoneId === zone.id));
    return sourceZones.map((zone) => ({
      ...zone,
      tables: visibleTables.filter((table) => table.zoneId === zone.id).map(geometryFor),
    }));
  }, [resolvedZoneId, selectedZone, visibleTables, zones]);
  const mapTables = useMemo(
    () =>
      resolvedZoneId
        ? visibleTables
        : visibleTables.filter((table) => table.zoneId != null && zones.some((zone) => zone.id === table.zoneId)),
    [resolvedZoneId, visibleTables, zones],
  );
  const mapHasTables = mapDocuments.some((document) => document.tables.length > 0);
  const selectedTable = tables.find((table) => table.tableId === selectedTableId) ?? null;
  const selectedTableForView =
    selectedTable &&
    isKnownServerFloorTableState(selectedTable.state) &&
    visibleTables.some((table) => table.tableId === selectedTable.tableId)
      ? selectedTable
      : null;
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
    if (!selectedTable || !isKnownServerFloorTableState(selectedTable.state)) {
      if (selectedTableId) setSelectedTableId(null);
      return;
    }
    if (!visibleTables.some((table) => table.tableId === selectedTable.tableId)) setSelectedTableId(null);
  }, [selectedTable, selectedTableId, visibleTables]);

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
          view={effectiveView}
          zoneId={resolvedZoneId}
          zones={zones}
          connectionState={floor.connectionState}
          lastConfirmed={floor.snapshot?.serverTime}
          searchQuery={searchQuery}
          onRetry={() => void floor.refresh()}
          onViewChange={setView}
          onZoneChange={setZoneId}
          onSearchChange={setSearchQuery}
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

        {floor.snapshot && tables.length > 0 && effectiveView === 'map' && !mapHasTables && (
          <div className={styles.statePanel}>{t('no_tables_here', 'No tables in this area right now.')}</div>
        )}

        {floor.snapshot && mapHasTables && effectiveView === 'map' && (
          <ServerFloorMapPanel
            documents={mapDocuments}
            states={states}
            selectedTable={selectedTableForView}
            formatTableLabel={formatTableLabel}
            onSelectTable={selectTable}
          />
        )}

        {floor.snapshot && tables.length > 0 && effectiveView === 'list' && (
          <section ref={listRef} className={styles.listPanel} aria-label={t('list', 'List')}>
            <div className={styles.tableList}>
              {visibleTables.length === 0 ? (
                <p className={styles.empty}>
                  {normalizedSearchQuery
                    ? t('server.no_matching_tables', 'No tables match your search.')
                    : t('no_tables_here', 'No tables in this area right now.')}
                </p>
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
