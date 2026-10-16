'use client';

import Link from '@/components/TenantLink';
import { useTranslation } from 'react-i18next';
import type { StatusBadgeTone } from '@/components/design-system/StatusBadge';
import StaffTableCard from '@/components/table-service/StaffTableCard';
import { formatCurrency } from '@/utils/currency';
import { isKnownServerFloorTableState, type ServerFloorTable } from '@/types/serverWorkspace';
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
  MarkTableReady: { key: 'server.floor.ready_action', fallback: 'Ready for next guests', destination: 'table' },
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
    case 'NeedsReset':
      return { key: 'server.floor.needs_reset', fallback: 'Needs reset', tone: 'warning' };
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

export default function ServerFloorTableCard({
  table,
  selected = false,
  isStale = false,
  onSelect,
}: Readonly<ServerFloorTableCardProps>) {
  const { t, i18n } = useTranslation();
  const status = statusCopy(table.state);
  const known = isKnownServerFloorTableState(table.state);
  const session = table.session;
  const balance = session?.remaining ?? table.legacy?.outstanding;
  const route = `/server/tables/${encodeURIComponent(table.tableId)}`;
  const canStart = table.state === 'Available' && table.permittedActions.includes('StartTable');
  const actions = known
    ? actionLinks(
        table.permittedActions.filter((action) => action !== 'StartTable'),
        table.tableId,
      )
    : null;
  return (
    <StaffTableCard
      label={t('cashier.tables.table_number', 'Table {{table}}', { table: table.tableLabel })}
      status={table.state === 'Available' ? t('server.status_available') : t(status.key, status.fallback)}
      tone={table.state === 'Available' ? 'success' : status.tone}
      accessibleLabel={`${t('cashier.tables.table_number', 'Table {{table}}', { table: table.tableLabel })}: ${canStart ? t('staff.add_order', 'Add order') : known ? t('server.open_table', 'Open table details') : t('unavailable', 'Table details unavailable')}`}
      selected={selected}
      disabled={!known || (canStart && isStale)}
      href={canStart ? undefined : route}
      onSelect={() => onSelect?.(table.tableId)}
      actionLabel={
        canStart
          ? t('staff.add_order', 'Add order')
          : known
            ? t('server.open_table', 'Open table details')
            : t('unavailable', 'Table details unavailable')
      }
      actions={
        known &&
        table.permittedActions.length > 0 &&
        (isStale ? (
          <output className={styles.actionNotice} aria-live="polite">
            {t(
              'server.floor.actions_stale',
              'Table actions may be out of date. Open table details to check current options.',
            )}
          </output>
        ) : (
          <>
            {actions?.links.map((action) => (
              <Link
                key={action.action}
                className={styles.actionLink}
                href={
                  action.action === 'AddRound' && session
                    ? `${route}/order?serviceSessionId=${encodeURIComponent(session.serviceSessionId)}`
                    : action.href
                }
              >
                {t(action.key, action.fallback)}
              </Link>
            ))}
            {actions && actions.unsupportedCount > 0 && (
              <output className={styles.actionNotice} aria-live="polite">
                {t(
                  'server.floor.action_unsupported',
                  'This action has no supported link from the floor in this version. Open table details to check current options.',
                )}
              </output>
            )}
          </>
        ))
      }
    >
      <span>{t('seats_count', '{{count}} seats', { count: table.maxGuests })}</span>
      {(session || table.legacy) && (
        <span>
          {t('cashier.remaining')}:{' '}
          <span>{formatCurrency(balance ?? 0, i18n.language || 'en', session?.currency ?? undefined)}</span>
        </span>
      )}
      {table.activeRoundCount > 0 && (
        <span>
          {t('cashier.tables.rounds', { count: table.activeRoundCount })}
          {table.readyRoundCount > 0 && <> · {t('server.status_ready')}</>}
        </span>
      )}
      {table.reservation && (
        <span>
          {t('server.upcoming_reservation')}: <span dir="auto">{table.reservation.customerName}</span> ·{' '}
          {table.reservation.startTime}
        </span>
      )}
    </StaffTableCard>
  );
}
