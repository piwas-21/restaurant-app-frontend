'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import type { OrderStatus, TableServiceSessionDto } from '@/types/order';
import styles from './TableAccountWorkspace.module.css';

interface ActivityEvent {
  readonly id: string;
  readonly at: string;
  readonly kind: 'opened' | 'closed' | 'order' | 'status';
  readonly orderNumber?: string;
  readonly status?: OrderStatus;
}

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'OutForDelivery',
  'InTransit',
  'In Progress',
  'Delivered',
  'Completed',
  'Cancelled',
  'Refunded',
  'PendingApproval',
]);

function projectedActivityEvents(session: TableServiceSessionDto): ActivityEvent[] {
  const events: ActivityEvent[] = [{ id: 'visit-opened', at: session.openedAt, kind: 'opened' }];
  if (session.closedAt) events.push({ id: 'visit-closed', at: session.closedAt, kind: 'closed' });

  for (const event of session.bill.accountActivity ?? []) {
    if (event.kind !== 'OrderPlaced' && event.kind !== 'StatusChanged') continue;
    events.push({
      id: event.id,
      at: event.occurredAt,
      kind: event.kind === 'OrderPlaced' ? 'order' : 'status',
      orderNumber: event.orderNumber,
      ...(event.kind === 'StatusChanged' && KNOWN_STATUSES.has(event.status)
        ? { status: event.status as OrderStatus }
        : {}),
    });
  }

  return events.sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
}

function legacyActivityEvents(session: TableServiceSessionDto): ActivityEvent[] {
  const events: ActivityEvent[] = [{ id: 'visit-opened', at: session.openedAt, kind: 'opened' }];
  if (session.closedAt) events.push({ id: 'visit-closed', at: session.closedAt, kind: 'closed' });

  for (const order of session.bill.orders) {
    const orderTime = order.orderDate || order.createdAt;
    if (orderTime)
      events.push({ id: `order-${order.id}`, at: orderTime, kind: 'order', orderNumber: order.orderNumber });
    for (const change of order.statusHistory ?? []) {
      events.push({
        id: `status-${change.id}`,
        at: change.changedAt,
        kind: 'status',
        orderNumber: order.orderNumber,
        status: change.status,
      });
    }
  }

  return events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

function activityEvents(session: TableServiceSessionDto): ActivityEvent[] {
  return Array.isArray(session.bill.accountActivity) ? projectedActivityEvents(session) : legacyActivityEvents(session);
}

export default function TableAccountActivityPanel({
  session,
  timeZone,
}: Readonly<{ session: TableServiceSessionDto; timeZone?: string }>) {
  const { t, i18n } = useTranslation();
  const events = useMemo(() => activityEvents(session), [session]);
  const projectionAvailable = Array.isArray(session.bill.accountActivity);
  if (events.length === 0)
    return (
      <>
        {projectionAvailable && session.bill.hasMoreAccountActivity && (
          <p className={styles.note} role="note">
            {t('cashier.tables.account_activity_has_more')}
          </p>
        )}
        <p className={styles.empty}>{t('cashier.tables.account_no_activity')}</p>
      </>
    );

  return (
    <>
      {projectionAvailable && session.bill.hasMoreAccountActivity && (
        <p className={styles.note} role="note">
          {t('cashier.tables.account_activity_has_more')}
        </p>
      )}
      <ol className={styles.activity}>
        {events.map((event) => {
          const title =
            event.kind === 'opened'
              ? t('cashier.tables.account_visit_opened')
              : event.kind === 'closed'
                ? t('cashier.tables.account_visit_closed')
                : event.kind === 'order'
                  ? t('cashier.tables.account_order_recorded')
                  : t('cashier.tables.account_order_status');
          return (
            <li key={event.id} className={styles.event}>
              <span className={styles.eventMarker} aria-hidden="true" />
              <div className={styles.eventContent}>
                <strong>{title}</strong>
                {event.orderNumber && <span dir="auto">{event.orderNumber}</span>}
                {event.status && <OrderStatusBadge status={event.status} />}
                <time dateTime={event.at}>
                  {formatCashierDateTime(
                    event.at,
                    i18n.language || 'en',
                    timeZone,
                    'short',
                    t('cashier.tables.unknown_time'),
                  )}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
