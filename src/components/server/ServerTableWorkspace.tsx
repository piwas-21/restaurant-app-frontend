'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import { formatTableMoney } from '@/lib/cashierTableSession';
import { isKnownServerFloorTableState } from '@/types/serverWorkspace';
import type { ServerTableBlocker, ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import { tableStatusLabel } from './serverFloorPresentation';
import styles from './ServerTableWorkspace.module.css';
import ServerTasksBadge from './tasks/ServerTasksBadge';
import ServerTableBillWorkspace from './bill/ServerTableBillWorkspace';

interface ServerTableWorkspaceProps {
  readonly tableId: string;
  readonly state: ServerTableSessionState;
  readonly requestedSessionId?: string;
  readonly requestedOrderId?: string;
}

function statusTone(state: string): StatusBadgeTone {
  if (state === 'Ready') return 'success';
  if (state === 'Reserved') return 'warning';
  if (state === 'Ambiguous' || state === 'Inactive') return 'danger';
  if (state === 'Open') return 'info';
  return 'neutral';
}

function blockerCopy(blocker: ServerTableBlocker, t: TFunction): string | null {
  switch (blocker) {
    case 'reserved':
      return t('cashier.tables.reserved_table');
    case 'inactive':
      return t('cashier.tables.closed_table');
    case 'ambiguous':
      return t('cashier.tables.ambiguous');
    case 'legacy':
      return t('cashier.tables.legacy_table');
    case 'missing-session':
      return t('cashier.tables.no_session');
    case 'stale':
      return t('server.snapshot_stale');
    case 'unavailable':
      return t('cashier.tables.session_unavailable');
    default:
      return null;
  }
}

function tableLabel(table: ServerTableSessionState['table'], tableId: string, t: TFunction): string {
  if (table?.tableLabel.trim()) return table.tableLabel;
  return t('cashier.tables.table_number', 'Table {{table}}', { table: tableId });
}

export default function ServerTableWorkspace({
  tableId,
  state,
  requestedSessionId,
  requestedOrderId,
}: ServerTableWorkspaceProps) {
  const { t } = useTranslation();
  const table = state.table;
  const session = state.session;
  const label = tableLabel(table, tableId, t);
  const knownState = table && isKnownServerFloorTableState(table.state) ? table.state : null;
  const blockerMessage = blockerCopy(state.blocker, t);
  const requestedSessionMismatch = Boolean(
    requestedSessionId && state.session && requestedSessionId !== state.session.serviceSessionId,
  );
  const requestedSessionUnavailable = Boolean(requestedSessionId && !state.isLoading && !state.session);
  const taskContextBlocked = requestedSessionMismatch || requestedSessionUnavailable;
  const roundHref = session
    ? `/server/tables/${encodeURIComponent(tableId)}/order?serviceSessionId=${encodeURIComponent(session.serviceSessionId)}`
    : null;

  return (
    <StaffWorkspaceShell
      navItems={[
        { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
        { href: '/server/tasks', label: t('server.tasks.title', 'Tasks'), badge: <ServerTasksBadge /> },
        { href: '/server/takeaway', label: t('server.takeaway.link') },
      ]}
      connectionState={state.floorConnectionState}
      lastConfirmed={state.floorLastConfirmed}
      onRetryConnection={() => void state.refresh()}
      className={styles.shell}
    >
      <div className={styles.workspace} data-testid="server-table-workspace">
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>{t('cashier.tables.session')}</p>
            <h1 dir="auto">{label}</h1>
            {table?.zoneName && (
              <p className={styles.context} dir="auto">
                {table.zoneName}
              </p>
            )}
          </div>
          <Link className={styles.control} href="/server/floor">
            {t('cashier.tables.back')}
          </Link>
        </header>

        {state.isStale && (
          <output className={styles.staleNotice} aria-live="polite">
            {t('server.status_stale')} · {t('server.last_confirmed')}
          </output>
        )}

        {!state.table && state.isLoading && (
          <div className={styles.statePanel}>{t('cashier.tables.session_loading')}</div>
        )}
        {!state.table && !state.isLoading && (
          <div className={styles.statePanel} role="alert">
            {state.error ? t(state.error, state.error) : t('cashier.tables.table_not_found')}
          </div>
        )}

        {table && (
          <>
            <section className={styles.tableSummary} aria-label={t('cashier.tables.session_details')}>
              <div className={styles.summaryIdentity}>
                <span className={styles.tableId} dir="auto">
                  {label}
                </span>
                <StatusBadge tone={statusTone(table.state)}>
                  {knownState ? tableStatusLabel(table, t) : t('unavailable')}
                </StatusBadge>
              </div>
              <dl className={styles.metrics}>
                <div>
                  <dt>{t('server.capacity')}</dt>
                  <dd>{t('cashier.tables.capacity_other', '{{count}} seats', { count: table.maxGuests })}</dd>
                </div>
                {session && (
                  <>
                    <div>
                      <dt>{t('cashier.tables.rounds_other')}</dt>
                      <dd>{session.roundCount}</dd>
                    </div>
                    <div>
                      <dt>{t('cashier.tables.outstanding')}</dt>
                      <dd>
                        {formatTableMoney(session.bill.remaining, session) ?? t('cashier.tables.currency_unknown')}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </section>

            {blockerMessage && state.blocker !== 'stale' && (
              <div className={styles.warning} role="alert">
                {blockerMessage}
              </div>
            )}
            {(requestedSessionMismatch || requestedSessionUnavailable) && (
              <div className={styles.warning} role="alert">
                {t(
                  'server.tasks.session_mismatch',
                  'This task belongs to a different table visit. Refresh the task list before continuing.',
                )}
                {requestedOrderId && <span dir="auto"> · {requestedOrderId}</span>}
              </div>
            )}
            {table.reservation && (
              <p className={styles.reservation}>
                <strong>{t('server.upcoming_reservation', 'Upcoming Reservation')}:</strong>{' '}
                <span dir="auto">{table.reservation.customerName}</span> · {table.reservation.startTime}
              </p>
            )}
            {state.error && (
              <div className={styles.warning} role="alert">
                {t(state.error, state.error)}
              </div>
            )}
            {state.repairSuccess && (
              <div className={styles.success} role="status" aria-live="polite">
                {t('cashier.tables.legacy_repair_success')}
              </div>
            )}

            {state.isLoading && !session && (
              <output className={styles.loadingNotice} aria-live="polite">
                {t('cashier.tables.session_loading')}
              </output>
            )}

            <div className={styles.actionRow}>
              {(state.blocker === 'legacy' || state.blocker === 'ambiguous') &&
                table.permittedActions.includes('ReviewLegacy') && (
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={() => void state.repairLegacyOrders().catch(() => undefined)}
                    disabled={state.isRepairingLegacyOrders || state.isStale || state.isStarting}
                  >
                    {state.isRepairingLegacyOrders
                      ? t('cashier.tables.legacy_repairing')
                      : t('cashier.tables.resolve_legacy_orders')}
                  </button>
                )}
              {!session && table.state === 'Available' && (
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => void state.startTable().catch(() => undefined)}
                  disabled={!state.canStartTable}
                >
                  {state.isStarting ? t('cashier.tables.opening') : t('server.open_table')}
                </button>
              )}
              {roundHref &&
                (state.canAddRound && !taskContextBlocked ? (
                  <Link className={styles.secondaryAction} href={roundHref}>
                    {t('cashier.tables.add_round')}
                  </Link>
                ) : (
                  <button type="button" className={styles.secondaryAction} disabled>
                    {t('cashier.tables.add_round')}
                  </button>
                ))}
            </div>

            {session && (
              <ServerTableBillWorkspace
                session={session}
                actionsBlocked={taskContextBlocked || state.isStale || state.isRepairingLegacyOrders}
                refreshWorkspace={state.refresh}
              />
            )}
          </>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}
