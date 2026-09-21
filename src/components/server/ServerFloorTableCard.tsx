'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
  onSelect?: (tableId: string) => void;
}

interface StatusCopy {
  key: string;
  fallback: string;
  tone: StatusBadgeTone;
}

const ACTION_COPY: Readonly<Record<string, [string, string]>> = {
  StartTable: ['server.open_table', 'Open table'],
  AddRound: ['server.add_to_order', 'Add round'],
  ViewBill: ['cashier.tables.total', 'View bill'],
  OpenTasks: ['server.active_orders', 'Open tasks'],
  CollectPayment: ['cashier.add_payment', 'Collect payment'],
  CloseVisit: ['close', 'Close visit'],
  ReviewLegacy: ['cashier.tables.status_legacy', 'Review legacy orders'],
};

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
    case 'Reserved':
      return 'reserved';
    case 'Inactive':
      return 'closed';
    default:
      return null;
  }
}

function actionLabel(action: string, t: TFunction): string {
  const copy = ACTION_COPY[action];
  return copy ? t(copy[0], copy[1]) : action;
}

export default function ServerFloorTableCard({
  table,
  selected = false,
  onSelect,
}: Readonly<ServerFloorTableCardProps>) {
  const { t } = useTranslation();
  const status = statusCopy(table.state);
  const knownTableState = isKnownServerFloorTableState(table.state) ? table.state : null;
  const stripState = knownTableState ? serviceState(knownTableState) : null;
  const session = table.session;
  const balance = session?.remaining ?? table.legacy?.outstanding;
  const route = `/server/tables/${encodeURIComponent(table.tableId)}`;

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

      {table.permittedActions.length > 0 && (
        <div className={styles.capabilitySummary}>
          <strong>{t('server.capabilities', 'Available capabilities')}</strong>
          <span>{t('server.capabilities_not_wired', 'Informational only; controls are not wired yet.')}</span>
          <ul className={styles.actionList} aria-label={t('server.capabilities', 'Available capabilities')}>
            {table.permittedActions.map((action) => (
              <li key={action}>{actionLabel(action, t)}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
