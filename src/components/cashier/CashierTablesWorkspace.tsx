'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import StaffButton from '@/components/design-system/StaffButton';
import { useTranslation } from 'react-i18next';
import CashierWorkspaceShell from './CashierWorkspaceShell';
import CashierTableMap from './CashierTableMap';
import CashierTableList from './CashierTableList';
import TableReadinessAction from '@/components/table-service/TableReadinessAction';
import CashierTableEmptyState from './CashierTableEmptyState';
import CashierTableSessionPanel from './CashierTableSessionPanel';
import CashierReleasedTableVisits from './CashierReleasedTableVisits';
import { useCashierTables } from '@/hooks/cashier/useCashierTables';
import { useCashierTableRoute } from '@/hooks/cashier/useCashierTableRoute';
import { useCashierTableSession } from '@/hooks/cashier/useCashierTableSession';
import { useCashierTenantTimeZoneState } from '@/hooks/cashier/useCashierTenantTimeZone';
import { cashierTableQueueState, findSelectedCashierTableEntry } from '@/lib/cashierTableWorkspace';
import type { TableServiceSessionDto } from '@/types/order';
import { useCashierTableWorkspaceActions } from './useCashierTableWorkspaceActions';
import CashierTableViewControls from './CashierTableViewControls';
import styles from './CashierTablesWorkspace.module.css';

type TableView = 'map' | 'list';

export default function CashierTablesWorkspace() {
  const { t } = useTranslation();
  const tables = useCashierTables();
  const route = useCashierTableRoute();
  const selectedFromList = useMemo(
    () => findSelectedCashierTableEntry(tables.entries, route.selectedSessionId, route.selectedTableNumber),
    [route.selectedSessionId, route.selectedTableNumber, tables.entries],
  );
  const [recoveredSession, setRecoveredSession] = useState<TableServiceSessionDto | null>(null);
  const sessionId = route.selectedSessionId ?? selectedFromList?.session?.serviceSessionId ?? null;
  const session = useCashierTableSession(sessionId, recoveredSession);
  const selectedSession =
    sessionId && session.session?.serviceSessionId.toLowerCase() === sessionId.toLowerCase() ? session.session : null;
  const timeZoneState = useCashierTenantTimeZoneState();
  const timeZone = timeZoneState.timeZone;
  const [view, setView] = useState<TableView>('map');
  let selectedTableNumber: string | null = route.selectedTableNumber;
  if (sessionId) selectedTableNumber = null;
  if (selectedFromList?.table.tableNumber != null) selectedTableNumber = selectedFromList.table.tableNumber;
  if (selectedSession?.tableNumber != null) selectedTableNumber = String(selectedSession.tableNumber);
  const hasSelection = Boolean(route.selectedSessionId || route.selectedTableNumber);
  const navigationDisabled = tables.isMutating || session.isMutating || session.pendingOperation !== null;
  const queueState = cashierTableQueueState(
    tables.queueState,
    sessionId,
    session.isLoading,
    session.isStale,
    Boolean(selectedSession),
    tables.entries.length > 0,
  );
  const selectedEntry =
    selectedFromList ??
    (route.selectedSessionId ? null : findSelectedCashierTableEntry(tables.entries, null, selectedTableNumber));
  const { openSession, resolveLegacyOrders } = useCashierTableWorkspaceActions(
    selectedEntry,
    tables,
    route,
    setRecoveredSession,
  );

  useEffect(() => {
    if (!navigationDisabled || typeof window === 'undefined') return;
    const guardedUrl = window.location.href;
    const preventPopState = (event: PopStateEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.history.pushState(window.history.state, '', guardedUrl);
    };
    window.addEventListener('popstate', preventPopState, true);
    return () => window.removeEventListener('popstate', preventPopState, true);
  }, [navigationDisabled]);

  const selectTable = useCallback(
    (tableNumber: string, serviceSessionId?: string) => route.navigateToTable(tableNumber, serviceSessionId),
    [route],
  );
  const refresh = useCallback(() => {
    void tables.refresh();
    if (sessionId) void session.refresh();
  }, [session, sessionId, tables]);
  return (
    <CashierWorkspaceShell activeDestination="tables" queueState={queueState} navigationDisabled={navigationDisabled}>
      <section className={styles.destination} aria-labelledby="cashier-tables-title">
        <header className={styles.header}>
          <div>
            <h1 id="cashier-tables-title" className={styles.title}>
              {t('cashier.workspace.tables')}
            </h1>
            <p className={styles.description}>{t('cashier.workspace.tables_description')}</p>
          </div>
          <CashierTableViewControls
            view={view}
            disabled={navigationDisabled}
            isLoading={tables.isLoading}
            onViewChange={setView}
            onRefresh={refresh}
          />
        </header>
        {tables.error && (
          <div className={styles.alert} role="alert">
            {tables.error.startsWith('cashier.') ? t(tables.error) : tables.error}
          </div>
        )}
        {tables.repairSuccess && (
          <div className={styles.notice} role="status" aria-live="polite">
            {t('cashier.tables.legacy_repair_success')}
          </div>
        )}
        <CashierReleasedTableVisits
          sessions={tables.releasedSessions}
          disabled={navigationDisabled}
          onSelect={(releasedSessionId) => route.navigateToSession(releasedSessionId)}
        />
        {timeZoneState.isLoading && <output className={styles.state}>{t('cashier.tables.time_zone_loading')}</output>}
        {timeZoneState.hasError && (
          <div className={styles.alert} role="alert">
            {t('cashier.tables.time_zone_unavailable')}
          </div>
        )}
        {tables.isLoading && tables.entries.length === 0 && (
          <output className={styles.state}>{t('cashier.tables.loading')}</output>
        )}
        {!tables.isLoading && tables.entries.length === 0 && !tables.error && (
          <p className={styles.state}>{t('cashier.tables.no_tables')}</p>
        )}
        {(tables.entries.length > 0 || tables.isLoading || hasSelection) && (
          <div className={`${styles.grid} ${hasSelection ? styles.hasSelection : ''}`}>
            <section className={styles.listPane} aria-label={t('cashier.tables.list_label')}>
              {view === 'map' ? (
                <CashierTableMap
                  entries={tables.entries}
                  selectedTableNumber={selectedTableNumber ?? null}
                  onSelectTable={selectTable}
                  disabled={navigationDisabled}
                />
              ) : (
                <div className={styles.listScroll}>
                  <CashierTableList
                    entries={tables.entries}
                    selectedTableNumber={selectedTableNumber ?? null}
                    timeZone={timeZone}
                    onSelectTable={selectTable}
                    disabled={navigationDisabled}
                  />
                </div>
              )}
            </section>
            {hasSelection && (
              <section className={styles.detailPane} aria-label={t('cashier.tables.session_details')}>
                {selectedEntry && (
                  <TableReadinessAction
                    tableId={selectedEntry.table.id}
                    snapshot={selectedEntry.table}
                    readinessVersion={selectedEntry.table.readinessVersion}
                    canMarkReady={selectedEntry.status === 'needs-reset' && !selectedEntry.session}
                    isStale={
                      tables.queueState !== 'ready' ||
                      tables.isLoading ||
                      session.isLoading ||
                      (sessionId !== null && !selectedSession) ||
                      navigationDisabled
                    }
                    refresh={tables.refresh}
                  />
                )}
                {sessionId && session.isLoading && (
                  <output className={styles.state}>{t('cashier.tables.session_loading')}</output>
                )}
                {sessionId && selectedSession && (
                  <CashierTableSessionPanel
                    session={selectedSession}
                    timeZone={timeZone}
                    error={session.error}
                    isMutating={session.isMutating || session.isLoading || tables.isMutating}
                    isStale={session.isStale}
                    pendingOperation={session.pendingOperation}
                    hasLegacyConflict={selectedEntry?.status === 'conflict'}
                    isRepairingLegacyOrders={tables.isMutating}
                    onResolveLegacyOrders={() => void resolveLegacyOrders().catch(() => undefined)}
                    onBack={route.clearSelection}
                    onRefresh={() => void session.refresh()}
                    onSubmitPayment={async (payment) => {
                      await session.submitPayment(payment);
                      void tables.refresh();
                    }}
                    onCloseSession={async () => {
                      await session.closeSession();
                      void tables.refresh();
                    }}
                    onReleaseTable={async () => {
                      const released = await session.releaseTable();
                      setRecoveredSession(released);
                      void tables.refresh();
                    }}
                    onClearAndReleaseTable={async () => {
                      const released = await session.clearAndReleaseTable();
                      setRecoveredSession(released);
                      void tables.refresh();
                    }}
                    onReconcilePendingOperation={session.reconcilePendingOperation}
                  />
                )}
                {sessionId && !session.isLoading && !session.session && (
                  <div className={styles.alert} role="alert">
                    {(session.error?.startsWith('cashier.') ? t(session.error) : session.error) ??
                      t('cashier.tables.session_unavailable')}
                    <StaffButton onClick={route.clearSelection}>{t('cashier.tables.back')}</StaffButton>
                  </div>
                )}
                {!sessionId && selectedEntry && (
                  <CashierTableEmptyState
                    entry={selectedEntry}
                    isOpening={tables.isMutating}
                    isRepairingLegacyOrders={tables.isMutating}
                    onBack={route.clearSelection}
                    onOpenSession={() => void openSession().catch(() => undefined)}
                    onResolveLegacyOrders={() => void resolveLegacyOrders().catch(() => undefined)}
                    onClearLegacyOrders={async () => {
                      await tables.clearLegacyTableOrders(selectedEntry.table.tableNumber);
                      route.clearSelection();
                    }}
                  />
                )}
                {!sessionId && !selectedEntry && (
                  <div className={styles.alert} role="alert">
                    <p>{t('cashier.tables.table_not_found')}</p>
                    <StaffButton onClick={route.clearSelection}>{t('cashier.tables.back')}</StaffButton>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </section>
    </CashierWorkspaceShell>
  );
}
