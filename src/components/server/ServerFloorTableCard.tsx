'use client';

import Link from '@/components/TenantLink';
import { useTranslation } from 'react-i18next';
import TableServiceStrip from '@/components/design-system/TableServiceStrip';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import type { TableServiceState } from '@/lib/operationalStatus';
import { formatCurrency } from '@/utils/currency';
import {
  isKnownServerFloorTableState,
  type KnownServerFloorTableState,
  type ServerFloorTable,
} from '@/types/serverWorkspace';
import styles from './ServerFloorTableCard.module.css';

interface ServerFloorTableCardProps {
  table: ServerFloorTable;
  selected?: boolean;
  isStale?: boolean;
  onSelect?: (tableId: string) => void;
}

interface StatusCopy {
  key: string;
  fallback: string;
  tone: StatusBadgeTone;
}

type ActionDestination = 'table' | 'bill' | 'tasks';

interface ActionCopy {
  key: string;
  fallback: string;
  destination: ActionDestination;
}

interface ActionLink {
  action: string;
  key: string;
  fallback: string;
  href: string;
}

const ACTION_COPY: Readonly<Record<string, ActionCopy>> = {
  StartTable: { key: 'server.floor.start_visit', fallback: 'Start visit', destination: 'table' },
  AddRound: { key: 'cashier.tables.add_round', fallback: 'Add round', destination: 'table' },
  ViewBill: { key: 'server.floor.view_bill', fallback: 'View account', destination: 'bill' },
  OpenTasks: { key: 'server.tasks.title', fallback: 'Service tasks', destination: 'tasks' },
  CollectPayment: { key: 'server.floor.review_payment', fallback: 'Review payment', destination: 'bill' },
  RequestPaymentHandoff: {
    key: 'server.floor.review_handoff',
    fallback: 'Review cashier handoff',
    destination: 'bill',
  },
  CloseVisit: { key: 'server.floor.review_close', fallback: 'Review visit closure', destination: 'bill' },
  ReviewLegacy: {
    key: 'cashier.tables.resolve_legacy_orders',
    fallback: 'Review legacy orders',
    destination: 'table',
  },
};

function actionLinks(actions: readonly string[], tableId: string): { links: ActionLink[]; unsupportedCount: number } {
  const tableRoute = `/server/tables/${encodeURIComponent(tableId)}`;
  const links: ActionLink[] = [];
  let unsupportedCount = 0;

  for (const action of actions) {
    const copy = ACTION_COPY[action];
    if (!copy) {
      unsupportedCount += 1;
      continue;
    }

    let href = tableRoute;
    if (copy.destination === 'tasks') href = '/server/tasks';
    if (copy.destination === 'bill') href = `${tableRoute}#server-table-bill-actions`;
    links.push({ action, key: copy.key, fallback: copy.fallback, href });
  }

  return { links, unsupportedCount };
}

function statusCopy(state: string): StatusCopy {
  switch (state) {
    case 'Open':
      return { key: 'server.status_occupied', fallback: 'Open', tone: 'info' };
    case 'Ready':
      return { key: 'server.status_ready', fallback: 'Ready', tone: 'success' };
    case 'Reserved':
      return { key: 'server.status_reserved', fallback: 'Reserved', tone: 'warning' };
    case 'Ambiguous':
      return { key: 'cashier.tables.status_legacy', fallback: 'Needs review', tone: 'danger' };
    case 'Inactive':
      return { key: 'server.status_closed', fallback: 'Closed', tone: 'neutral' };
    default:
      return { key: 'unavailable', fallback: 'Unavailable', tone: 'neutral' };
  }
}

function serviceState(state: KnownServerFloorTableState): TableServiceState | null {
  switch (state) {
    case 'Available':
      return 'available';
    case 'Open':
      return 'occupied';
    case 'Ready':
      return 'ready';
    case 'Reserved':
      return 'reserved';
    case 'Inactive':
      return 'closed';
    default:
      return null;
  }
}

export default function ServerFloorTableCard({
  table,
  selected = false,
  isStale = false,
  onSelect,
}: Readonly<ServerFloorTableCardProps>) {
  const { t } = useTranslation();
  const status = statusCopy(table.state);
  const knownTableState = isKnownServerFloorTableState(table.state) ? table.state : null;
  const stripState = knownTableState ? serviceState(knownTableState) : null;
  const session = table.session;
  const balance = session?.remaining ?? table.legacy?.outstanding;
  const route = `/server/tables/${encodeURIComponent(table.tableId)}`;
  const actions = knownTableState ? actionLinks(table.permittedActions, table.tableId) : null;

  return (
    <article className={styles.tableCard} data-selected={selected} data-state={table.state}>
      {stripState ? (
        <TableServiceStrip
          tableLabel={table.tableLabel}
          state={stripState}
          elapsedMinutes={session?.ageMinutes}
          trailing={
            <Link className={styles.tableLink} href={route} onClick={() => onSelect?.(table.tableId)}>
              {t('server.open_table', 'Open table details')}
            </Link>
          }
        />
      ) : (
        <div className={styles.tableCardHeader}>
          <span className={styles.tableHeading} dir="auto">
            {t('server.table', 'Table')} {table.tableLabel}
          </span>
          <StatusBadge tone={status.tone} ariaLabel={t(status.key, status.fallback)}>
            {t(status.key, status.fallback)}
          </StatusBadge>
        </div>
      )}

      {knownTableState && stripState === null && (
        <div className={styles.tableCardHeader}>
          <Link className={styles.tableLink} href={route} onClick={() => onSelect?.(table.tableId)}>
            {t('server.open_table', 'Open table details')}
          </Link>
        </div>
      )}

      {!knownTableState && (
        <div className={styles.tableCardHeader}>
          <span className={styles.tableLink} aria-disabled="true">
            {t('unavailable', 'Table details unavailable')}
          </span>
        </div>
      )}

      <dl className={styles.tableMetrics}>
        <div>
          <dt>{t('server.capacity', 'Capacity')}</dt>
          <dd>{t('seats_count', '{{count}} seats', { count: table.maxGuests })}</dd>
        </div>
        {(session || table.legacy) && (
          <div>
            <dt>{t('cashier.remaining', 'Remaining')}</dt>
            <dd>{formatCurrency(balance ?? 0, undefined, session?.currency ?? undefined)}</dd>
          </div>
        )}
        {table.activeRoundCount > 0 && (
          <div>
            <dt>{t('cashier.tables.rounds_other', '{{count}} rounds', { count: table.activeRoundCount })}</dt>
            <dd>{table.readyRoundCount > 0 ? t('server.status_ready', 'Ready') : t('active', 'Active')}</dd>
          </div>
        )}
      </dl>

      {table.reservation && (
        <p className={styles.reservation}>
          <strong>{t('server.upcoming_reservation', 'Upcoming Reservation')}:</strong>{' '}
          <span dir="auto">{table.reservation.customerName}</span> · {table.reservation.startTime}
        </p>
      )}

      {knownTableState && table.permittedActions.length > 0 && (
        <div className={styles.capabilitySummary}>
          <strong>{t('server.capabilities', 'Table actions')}</strong>
          {isStale ? (
            <output className={styles.actionNotice} aria-live="polite">
              {t(
                'server.floor.actions_stale',
                'Table actions may be out of date. Open table details to check current options.',
              )}
            </output>
          ) : (
            <>
              {actions && actions.links.length > 0 && (
                <ul className={styles.actionList} aria-label={t('server.capabilities', 'Table actions')}>
                  {actions.links.map((action) => (
                    <li key={action.action}>
                      <Link className={styles.actionLink} href={action.href}>
                        {t(action.key, action.fallback)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {actions && actions.unsupportedCount > 0 && (
                <output className={styles.actionNotice} aria-live="polite">
                  {t(
                    'server.floor.action_unsupported',
                    'This action has no supported link from the floor in this version. Open table details to check current options.',
                  )}
                </output>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}
