'use client';

import { useTranslation } from 'react-i18next';
import type { CashierOrderGroupDto } from '@/types/cashier';
import CashierReadOnlyOrderList from './CashierReadOnlyOrderList';
import styles from './CashierWorkspaceList.module.css';

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
  onCollectSession,
}: CashierReadOnlyOrderGroupListProps) {
  const { t } = useTranslation();

  return (
    <ul className={styles.groupList} aria-label={t('cashier.workspace.order_list')}>
      {groups.map((group) => {
        const sessionId = group.serviceSessionId;
        if (!sessionId) {
          return (
            <li key={group.groupKey} className={styles.groupListItem}>
              {group.isArchivedFromTable && (
                <p className={styles.archivedOrderNotice}>
                  <span className={styles.visitStateBadge}>{t('cashier.workspace.prior_table_order')}</span>
                </p>
              )}
              <CashierReadOnlyOrderList
                orders={group.orders}
                selectedOrderId={selectedOrderId}
                timeZone={timeZone}
                onSelectOrder={onSelectOrder}
                onOrderRowRef={onOrderRowRef}
              />
            </li>
          );
        }

        const firstOrder = group.orders[0];
        const tableLabel =
          firstOrder?.tableLabel?.trim() ||
          (group.tableNumber !== null
            ? t('cashier.workspace.table_value', { table: group.tableNumber })
            : t('cashier.workspace.visit'));
        const pendingCount = group.orders.filter(
          (order) => order.status === 'Pending' || order.status === 'PendingApproval',
        ).length;
        const balanceCount = group.orders.filter((order) => {
          const due = typeof order.remainingAmount === 'number' ? order.remainingAmount : order.total - order.totalPaid;
          return due > 0;
        }).length;

        return (
          <li key={group.groupKey} className={styles.groupListItem}>
            <article className={styles.visitGroup} aria-labelledby={`visit-${group.groupKey}`}>
              <header className={styles.visitGroupHeader}>
                <div className={styles.visitGroupHeading}>
                  <div className={styles.visitGroupTitleRow}>
                    <h2 id={`visit-${group.groupKey}`} className={styles.visitGroupTitle} dir="auto">
                      {tableLabel}
                    </h2>
                    {group.releasedAt && (
                      <span className={styles.visitStateBadge}>{t('cashier.workspace.released_visit')}</span>
                    )}
                  </div>
                  <p className={styles.visitGroupSummary}>
                    <span>{t('cashier.workspace.group_rounds', { count: group.orders.length })}</span>
                    <span>{t('cashier.workspace.group_pending', { count: pendingCount })}</span>
                    <span>{t('cashier.workspace.group_with_balance', { count: balanceCount })}</span>
                  </p>
                </div>
                {onCollectSession && (
                  <button
                    type="button"
                    className={styles.visitCollectButton}
                    onClick={() => onCollectSession(sessionId)}
                  >
                    {t('cashier.workspace.collect_for_visit')}
                  </button>
                )}
              </header>
              <CashierReadOnlyOrderList
                orders={group.orders}
                selectedOrderId={selectedOrderId}
                timeZone={timeZone}
                onSelectOrder={onSelectOrder}
                onOrderRowRef={onOrderRowRef}
              />
            </article>
          </li>
        );
      })}
    </ul>
  );
}
