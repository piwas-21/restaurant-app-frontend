'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import CashierWorkspaceShell from './CashierWorkspaceShell';
import CashierCollectionPanel from './CashierCollectionPanel';
import { useCashierCollection } from '@/hooks/cashier/useCashierCollection';
import { useCashierOrderRoute } from '@/hooks/cashier/useCashierOrderRoute';
import { canCollectPayment } from '@/lib/settlementEligibility';
import { CASHIER_ORDERS_PATH } from '@/lib/cashierWorkspace';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './CashierCollection.module.css';

function messageFor(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('cashier.') ? t(error) : error;
}

export default function CashierCollectionWorkspace() {
  const { t } = useTranslation();
  const route = useCashierOrderRoute();
  const collection = useCashierCollection(route.selectedOrderId);
  const isPending = collection.isMutating || collection.isCheckingPayment;
  const queueState = collection.isLoading ? 'loading' : !collection.order && collection.error ? 'unavailable' : 'ready';
  const returnToOrder = useCallback(() => {
    if (route.selectedOrderId) route.navigateToOrder(route.selectedOrderId);
    else route.navigateToOrders();
  }, [route]);

  return (
    <CashierWorkspaceShell activeDestination="orders" queueState={queueState} navigationDisabled={isPending}>
      {collection.isLoading && <output className={styles.pendingNotice}>{t('cashier.workspace.order_loading')}</output>}
      {!collection.isLoading && !collection.order && (
        <section className={styles.collection} aria-labelledby="cashier-collection-title">
          <h1 id="cashier-collection-title">{t('cashier.collection.title')}</h1>
          <p role={collection.error ? 'alert' : undefined}>
            {messageFor(collection.error, t) || t('cashier.collection.order_required')}
          </p>
          <Link className={styles.backButton} href={CASHIER_ORDERS_PATH}>
            {t('cashier.collection.back_orders')}
          </Link>
        </section>
      )}
      {collection.order && !canCollectPayment(collection.order) && (
        <section className={styles.collection} aria-labelledby="cashier-collection-title">
          <header className={styles.collectionHeader}>
            <button type="button" className={styles.backButton} onClick={returnToOrder}>
              {t('cashier.collection.return_order')}
            </button>
            <div className={styles.orderIdentity}>
              <p className={styles.eyebrow}>{t('cashier.collection.order')}</p>
              <h1 id="cashier-collection-title" dir="auto">
                {collection.order.orderNumber}
              </h1>
            </div>
            <div className={styles.statuses}>
              <OrderStatusBadge status={collection.order.status} />
              <StatusBadge tone="neutral">{paymentStatusLabel(collection.order.paymentStatus, t)}</StatusBadge>
            </div>
          </header>
          <div className={styles.balanceCard} role="status">
            <span>{t('cashier.workspace.amount_due')}</span>
            <strong>{formatOrderCurrency(collection.order.remainingAmount, collection.order)}</strong>
          </div>
          <p>{t('cashier.collection.no_due')}</p>
        </section>
      )}
      {collection.order && canCollectPayment(collection.order) && (
        <CashierCollectionPanel
          order={collection.order}
          isPending={isPending}
          isCheckingPayment={collection.isCheckingPayment}
          onSubmit={collection.submitPayment}
          onBack={returnToOrder}
          onNextSale={route.navigateToOrders}
          onReturnToOrder={returnToOrder}
        />
      )}
    </CashierWorkspaceShell>
  );
}
