import { useTranslation } from 'react-i18next';
import { orderStatusLabel } from '@/lib/orderStatus';
import type { KitchenBoardOrder } from '@/types/kitchenBoard';
import StaffButton from '@/components/design-system/StaffButton';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import KitchenBoardItemTree from './KitchenBoardItemTree';
import styles from './KitchenBoardWorkCard.module.css';

function statusTone(status: string): StatusBadgeTone {
  if (status === 'Ready' || status === 'Delivered' || status === 'Completed') return 'success';
  if (status === 'Preparing') return 'info';
  if (status === 'Confirmed') return 'warning';
  return 'neutral';
}

export default function KitchenBoardOrderCard({
  order,
  disabled,
  onPreparing,
  onReady,
  onComplete,
}: Readonly<{
  order: KitchenBoardOrder;
  disabled: boolean;
  onPreparing: () => void;
  onReady: () => void;
  onComplete: () => void;
}>) {
  const { t } = useTranslation();
  const location =
    order.tableLabel ??
    (order.tableNumber === null ? null : t('nativeKitchenBoard.tableNumber', { number: order.tableNumber }));

  return (
    <article className={styles.card} aria-labelledby={`kitchen-order-${order.orderId}`}>
      <header className={styles.header}>
        <div>
          <h3 id={`kitchen-order-${order.orderId}`} className={styles.title}>
            {t('nativeKitchenBoard.orderNumber', { number: order.orderNumber })}
          </h3>
          <p className={styles.meta}>
            {location && <span>{location}</span>}
            <span>{t(`nativeKitchenBoard.orderType.${order.type}`, { defaultValue: order.type })}</span>
          </p>
        </div>
        <StatusBadge tone={statusTone(order.status)}>{orderStatusLabel(order.status, t)}</StatusBadge>
      </header>

      <KitchenBoardItemTree items={order.items} />

      {order.requiredKitchenRoutes.length > 0 && (
        <div className={styles.routes} aria-label={t('nativeKitchenBoard.routes')}>
          {order.requiredKitchenRoutes.map((route) => (
            <StatusBadge
              key={`${order.orderId}-${route.target}`}
              tone={route.status === 'NotConfigured' ? 'neutral' : 'info'}
              size="sm"
            >
              {t('nativeKitchenBoard.routeStatus', {
                target: t(`nativeKitchenBoard.target.${route.target}`, { defaultValue: route.target }),
                status: t(`nativeKitchenBoard.route.${route.status}`, { defaultValue: route.status }),
              })}
            </StatusBadge>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        {order.status === 'Confirmed' && (
          <StaffButton variant="primary" disabled={disabled} onClick={onPreparing}>
            {t('nativeKitchenBoard.startPreparing')}
          </StaffButton>
        )}
        {order.status === 'Preparing' && (
          <StaffButton variant="primary" disabled={disabled} onClick={onReady}>
            {t('nativeKitchenBoard.markReady')}
          </StaffButton>
        )}
        {order.status === 'Ready' && !order.isCompleted && order.canComplete && (
          <StaffButton variant="primary" disabled={disabled} onClick={onComplete}>
            {t('nativeKitchenBoard.acknowledgeWork')}
          </StaffButton>
        )}
        {order.isCompleted && <span className={styles.completed}>{t('nativeKitchenBoard.workCompleted')}</span>}
      </div>
    </article>
  );
}
