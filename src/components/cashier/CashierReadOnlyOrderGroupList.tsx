'use client';

import { useTranslation } from 'react-i18next';
import type { CashierOrderGroupDto } from '@/types/cashier';
import CashierReadOnlyOrderList from './CashierReadOnlyOrderList';
import styles from './CashierWorkspaceList.module.css';

const activeStatusPriority = [
  'PendingApproval',
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'OutForDelivery',
  'Delivered',
];

interface CashierReadOnlyOrderGroupListProps {
  readonly groups: readonly CashierOrderGroupDto[];
  readonly selectedOrderId: string | null;
  readonly timeZone?: string;
  readonly onSelectOrder: (orderId: string) => void;
  readonly onOrderRowRef?: (orderId: string, node: HTMLButtonElement | null) => void;
  readonly onCollectSession?: (serviceSessionId: string) => void;
}

export default function CashierReadOnlyOrderGroupList({
  groups,
  selectedOrderId,
  timeZone,
  onSelectOrder,
  onOrderRowRef,
}: CashierReadOnlyOrderGroupListProps) {
  const { t } = useTranslation();
  return (
    <ul className={styles.groupList} aria-label={t('cashier.workspace.order_list')}>
      {groups.map((group) => {
        const first = group.orders[0];
        if (!first) return null;
        const selected = group.orders.some((order) => order.id.toLowerCase() === selectedOrderId?.toLowerCase());
        const liveOrders = group.orders.filter((order) => !['Cancelled', 'Refunded'].includes(order.status));
        const due = liveOrders.reduce(
          (sum, order) => sum + (order.remainingAmount ?? order.total - order.totalPaid),
          0,
        );
        const paid = liveOrders.reduce((sum, order) => sum + order.totalPaid, 0);
        const paymentStatus =
          liveOrders.length === 0
            ? first.paymentStatus
            : due < 0
              ? 'Overpaid'
              : due === 0
                ? 'Completed'
                : paid > 0
                  ? 'PartiallyPaid'
                  : 'Pending';
        const summary = {
          ...first,
          status:
            activeStatusPriority.find((status) => liveOrders.some((order) => order.status === status)) ?? first.status,
          remainingAmount: due,
          paymentStatus: group.orders.length > 1 ? paymentStatus : first.paymentStatus,
        };
        return (
          <li key={group.groupKey} className={styles.groupListItem}>
            {group.isArchivedFromTable && (
              <p className={styles.archivedOrderNotice}>{t('cashier.workspace.prior_table_order')}</p>
            )}
            <CashierReadOnlyOrderList
              orders={[summary]}
              updated={group.hasUpdates || group.orders.length > 1}
              selectedOrderId={selected ? first.id : null}
              timeZone={timeZone}
              onSelectOrder={onSelectOrder}
              onOrderRowRef={(_, node) => group.orders.forEach((order) => onOrderRowRef?.(order.id, node))}
            />
          </li>
        );
      })}
    </ul>
  );
}
