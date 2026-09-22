'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import { formatCurrency } from '@/utils/currency';
import type { ServerServiceTask } from '@/types/serverTasks';
import { taskIsDeliverable } from '@/hooks/serverWorkspace/useServerTasks';
import styles from './ServerTaskCard.module.css';

interface ServerTaskCardProps {
  readonly task: ServerServiceTask;
  readonly isBusy: boolean;
  readonly onDeliver: (orderId: string) => void;
}

const BUCKET_COPY: Readonly<Record<ServerServiceTask['bucket'], readonly [string, string]>> = {
  Ready: ['server.tasks.bucket_ready', 'Ready'],
  Overdue: ['server.tasks.bucket_overdue', 'Overdue'],
  Exception: ['server.tasks.bucket_exception', 'Exception'],
};

function bucketTone(bucket: ServerServiceTask['bucket']): StatusBadgeTone {
  if (bucket === 'Ready') return 'success';
  if (bucket === 'Exception') return 'danger';
  return 'warning';
}

function ageCopy(ageSeconds: number, t: TFunction) {
  const minutes = Math.floor(Math.max(0, ageSeconds) / 60);
  if (minutes < 1) return t('server.tasks.age_now', 'Now');
  if (minutes < 60) return t('server.tasks.age_minutes', '{{count}} min', { count: minutes });
  return t('server.tasks.age_hours', '{{count}} h', { count: Math.floor(minutes / 60) });
}

function orderTypeCopy(orderType: string, t: TFunction): string {
  switch (orderType) {
    case 'DineIn':
      return t('order_type_dine_in', 'Dine In');
    case 'Takeaway':
      return t('order_type_takeaway', 'Takeaway');
    case 'Delivery':
      return t('order_type_delivery', 'Delivery');
    default:
      return t('unavailable', 'Unavailable');
  }
}

function routingCopy(task: ServerServiceTask, t: TFunction): string {
  switch (task.routingState) {
    case 'Complete':
      return t('server.tasks.routing_complete', 'Routing complete');
    case 'Queued':
      return t('server.tasks.routing_queued', 'Queued for print');
    case 'Sent':
      return t('server.tasks.routing_sent', 'Sent to printer');
    case 'ExceptionRequired':
      return t('server.tasks.routing_required_exception', 'Required routing exception');
    case 'ExceptionOptional':
      return t('server.tasks.routing_optional_exception', 'Optional routing exception');
    default:
      return t('server.tasks.routing_unknown', 'Routing state unknown');
  }
}

function reasonCopy(reasonCode: string | null | undefined, t: TFunction): string | null {
  if (!reasonCode) return null;
  const known: Record<string, [string, string]> = {
    RequiredRoutingUnresolved: ['server.tasks.reason_required_routing', 'Resolve required routing before delivery.'],
    KitchenReleaseRequired: ['server.tasks.reason_kitchen_release', 'Kitchen release is required.'],
    InvalidStatusTransition: ['server.tasks.reason_status', 'This order status cannot be delivered.'],
    DeliveryNotPermitted: ['server.tasks.reason_not_permitted', 'Delivery is not permitted for this task.'],
  };
  const copy = known[reasonCode];
  return copy
    ? t(copy[0], copy[1])
    : t('server.tasks.reason_not_permitted', 'Delivery is not permitted for this task.');
}

function tableHref(task: ServerServiceTask): string | null {
  if (!task.tableId || !task.serviceSessionId) return null;
  const params = new URLSearchParams();
  if (task.serviceSessionId) params.set('serviceSessionId', task.serviceSessionId);
  params.set('orderId', task.orderId);
  return `/server/tables/${encodeURIComponent(task.tableId)}${params.toString() ? `?${params}` : ''}`;
}

export default function ServerTaskCard({ task, isBusy, onDeliver }: ServerTaskCardProps) {
  const { t } = useTranslation();
  const action = task.permittedDeliveryActions.find((candidate) => candidate.action === 'HandOver');
  const deliverable = taskIsDeliverable(task);
  const reason = reasonCopy(action?.reasonCode, t);
  const destination = tableHref(task);

  return (
    <article className={styles.card} data-bucket={task.bucket} data-testid={`server-task-${task.orderId}`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <strong dir="auto">{task.orderNumber}</strong>
          <span>{orderTypeCopy(task.orderType, t)}</span>
        </div>
        <StatusBadge tone={bucketTone(task.bucket)} ariaLabel={task.bucket}>
          {t(...BUCKET_COPY[task.bucket])}
        </StatusBadge>
        <OrderStatusBadge status={task.status} />
      </header>

      <dl className={styles.details}>
        <div>
          <dt>{t('server.tasks.age', 'Age')}</dt>
          <dd>{ageCopy(task.ageSeconds, t)}</dd>
        </div>
        <div>
          <dt>{t('server.tasks.routing', 'Routing')}</dt>
          <dd>{routingCopy(task, t)}</dd>
        </div>
        <div>
          <dt>{t('server.tasks.total', 'Total')}</dt>
          <dd>{formatCurrency(task.total)}</dd>
        </div>
      </dl>

      {(task.tableLabel || task.orderType === 'DineIn') && (
        <p className={styles.context}>
          {destination ? (
            <Link href={destination} dir="auto">
              {t('server.tasks.open_table', 'Open {{table}}', { table: task.tableLabel ?? task.tableId })}
            </Link>
          ) : (
            <span>{t('server.tasks.table_unknown', 'Table context unavailable')}</span>
          )}
        </p>
      )}

      <div className={styles.footer}>
        {!deliverable && reason && <span className={styles.reason}>{reason}</span>}
        <button
          type="button"
          className={styles.deliver}
          onClick={() => onDeliver(task.orderId)}
          disabled={!deliverable || isBusy}
          title={reason ?? undefined}
          aria-label={
            deliverable
              ? t('server.tasks.deliver_order', 'Deliver {{order}}', { order: task.orderNumber })
              : (reason ?? t('server.tasks.delivery_disabled', 'Delivery unavailable'))
          }
        >
          {isBusy ? t('server.tasks.delivering', 'Updating…') : t('server.tasks.deliver', 'Deliver')}
        </button>
      </div>
    </article>
  );
}
