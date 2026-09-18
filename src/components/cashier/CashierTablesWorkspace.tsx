'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { List, Map, RefreshCw } from 'lucide-react';
import StaffButton from '@/components/design-system/StaffButton';
import { useTranslation } from 'react-i18next';
import CashierWorkspaceShell from './CashierWorkspaceShell';
import CashierTableMap from './CashierTableMap';
import CashierTableList from './CashierTableList';
import CashierTableEmptyState from './CashierTableEmptyState';
import CashierTableSessionPanel from './CashierTableSessionPanel';
import { useCashierTables, type CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import { useCashierTableRoute } from '@/hooks/cashier/useCashierTableRoute';
import { useCashierTableSession } from '@/hooks/cashier/useCashierTableSession';
import { useCashierTenantTimeZoneState } from '@/hooks/cashier/useCashierTenantTimeZone';
import { tableNumberKey } from '@/lib/cashierTableSession';
import type { CashierQueueState } from '@/types/cashier';
import styles from './CashierTablesWorkspace.module.css';

type TableView = 'map' | 'list';

function messageFor(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('cashier.') ? t(error) : error;
}

function findSelectedEntry(
  entries: readonly CashierTableEntry[],
  sessionId: string | null,
  tableNumber: string | null,
) {
  if (sessionId) {
    const normalized = sessionId.toLowerCase();
    return entries.find((entry) => entry.session?.serviceSessionId.toLowerCase() === normalized) ?? null;
  }
  if (!tableNumber) return null;
  const key = tableNumberKey(tableNumber);
  return entries.find((entry) => tableNumberKey(entry.table.tableNumber) === key) ?? null;
}

function tableQueueState(
  base: CashierQueueState,
  sessionId: string | null,
  sessionLoading: boolean,
  sessionStale: boolean,
  hasSession: boolean,
  hasEntries: boolean,
): CashierQueueState {
  if (!sessionId) return base;
  if (sessionLoading) return 'loading';
  if (!sessionStale) return base;
  if (hasSession || hasEntries) return 'stale';
  return 'unavailable';
}

export default function CashierTablesWorkspace() {
  const { t } = useTranslation();
  const tables = useCashierTables();
  const route = useCashierTableRoute();
  const selectedFromList = useMemo(
    () => findSelectedEntry(tables.entries, route.selectedSessionId, route.selectedTableNumber),
    [route.selectedSessionId, route.selectedTableNumber, tables.entries],
  );
  const sessionId = route.selectedSessionId ?? selectedFromList?.session?.serviceSessionId ?? null;
  const session = useCashierTableSession(sessionId);
  const timeZoneState = useCashierTenantTimeZoneState();
  const timeZone = timeZoneState.timeZone;
  const [view, setView] = useState<TableView>('map');
  const selectedTableNumber =
    session.session?.tableNumber != null
      ? String(session.session.tableNumber)
      : (selectedFromList?.table.tableNumber ?? route.selectedTableNumber);
  const hasSelection = Boolean(route.selectedSessionId || route.selectedTableNumber);
  const navigationDisabled = tables.isMutating || session.isMutating || session.pendingOperation !== null;
  const queueState = tableQueueState(
    tables.queueState,
    sessionId,
    session.isLoading,
    session.isStale,
    Boolean(session.session),
    tables.entries.length > 0,
  );
  const selectedEntry = selectedFromList ?? findSelectedEntry(tables.entries, null, selectedTableNumber);

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
  const openSession = useCallback(async () => {
    if (!selectedEntry) return;
    const opened = await tables.openSession(selectedEntry.table.tableNumber);
    route.navigateToSession(opened.serviceSessionId);
  }, [route, selectedEntry, tables]);

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
          <div className={styles.headerActions}>
            <div className={styles.viewToggle} role="group" aria-label={t('cashier.tables.view_toggle')}>
              <StaffButton
                variant={view === 'map' ? 'primary' : 'secondary'}
                className={styles.viewButton}
                aria-pressed={view === 'map'}
                onClick={() => setView('map')}
              >
                <Map size={17} aria-hidden="true" /> {t('cashier.tables.map')}
              </StaffButton>
              <StaffButton
                variant={view === 'list' ? 'primary' : 'secondary'}
                className={styles.viewButton}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <List size={17} aria-hidden="true" /> {t('cashier.tables.list')}
              </StaffButton>
            </div>
            <StaffButton onClick={refresh} disabled={navigationDisabled || tables.isLoading}>
              <RefreshCw size={17} aria-hidden="true" /> {t('cashier.workspace.refresh')}
            </StaffButton>
          </div>
        </header>
        {tables.error && (
          <div className={styles.alert} role="alert">
            {messageFor(tables.error, t)}
          </div>
        )}
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
                {sessionId && session.isLoading && (
                  <output className={styles.state}>{t('cashier.tables.session_loading')}</output>
                )}
                {sessionId && !session.isLoading && session.session && (
                  <CashierTableSessionPanel
                    session={session.session}
                    timeZone={timeZone}
                    error={session.error}
                    isMutating={session.isMutating}
                    isStale={session.isStale}
                    pendingOperation={session.pendingOperation}
                    hasLegacyConflict={selectedEntry?.status === 'conflict'}
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
                    onReconcilePendingOperation={session.reconcilePendingOperation}
                  />
                )}
                {sessionId && !session.isLoading && !session.session && (
                  <div className={styles.alert} role="alert">
                    {messageFor(session.error, t) ?? t('cashier.tables.session_unavailable')}
                    <StaffButton onClick={route.clearSelection}>{t('cashier.tables.back')}</StaffButton>
                  </div>
                )}
                {!sessionId && selectedEntry && (
                  <CashierTableEmptyState
                    entry={selectedEntry}
                    isOpening={tables.isMutating}
                    onBack={route.clearSelection}
                    onOpenSession={() => void openSession().catch(() => undefined)}
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
