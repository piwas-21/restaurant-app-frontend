'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from '@/components/TenantLink';
import { useTranslation } from 'react-i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import MarketplaceOrderSource from '@/components/order/MarketplaceOrderSource';
import OrderAmendmentEntryButton from '@/components/order-amendments/OrderAmendmentEntryButton';
import OrderAmendmentHistorySection from '@/components/order-amendments/OrderAmendmentHistorySection';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useServerOrderTranslations } from '@/hooks/useServerOrderTranslations';
import { getServerOrderById } from '@/services/server/orders';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { serverOrderVisitHref } from './serverOrderRoute';
import styles from './ServerOrderDetailWorkspace.module.css';

interface ServerOrderDetailWorkspaceProps {
  readonly orderId: string;
}

function typeCopy(type: string, t: (key: string, fallback: string) => string): string {
  const keys: Record<string, readonly [string, string]> = {
    DineIn: ['order_type_dine_in', 'Dine In'],
    Takeaway: ['order_type_takeaway', 'Takeaway'],
    Delivery: ['order_type_delivery', 'Delivery'],
  };
  const copy = keys[type];
  return copy ? t(copy[0], copy[1]) : t('orderAmendments.order_type_unavailable', 'Unsupported order type');
}

export default function ServerOrderDetailWorkspace({ orderId }: Readonly<ServerOrderDetailWorkspaceProps>) {
  const { t } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const translations = useServerOrderTranslations(true);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loadedOrderId, setLoadedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const refreshOrder = useCallback(() => setReloadKey((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setOrder(null);
    setLoadedOrderId(null);
    setIsLoading(true);
    setError(null);
    void getServerOrderById(orderId)
      .then((fresh) => {
        if (active && fresh.id.toLowerCase() === orderId.toLowerCase()) {
          setOrder(fresh);
          setLoadedOrderId(orderId.toLowerCase());
        } else if (active) setError('orderAmendments.order_unavailable');
      })
      .catch((reason: unknown) => {
        if (active) setError(getErrorMessage(reason) ?? 'orderAmendments.order_unavailable');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderAmendmentsV1, orderId, reloadKey]);

  const visibleOrder = translations.ready && loadedOrderId === orderId.toLowerCase() ? order : null;
  const link = visibleOrder ? serverOrderVisitHref(visibleOrder) : null;
  let visitAction: ReactNode = null;
  if (link) {
    visitAction = (
      <Link className={styles.control} href={link}>
        {t('serverOrders.open_visit', 'Open this table visit')}
      </Link>
    );
  } else if (visibleOrder?.type === 'DineIn') {
    visitAction = (
      <p className={styles.state}>
        {t(
          'orderAmendments.visit_link_unavailable',
          'This order has no stable table and visit identity, so its table account cannot be opened from the display label.',
        )}
      </p>
    );
  }
  return (
    <StaffWorkspaceShell
      navItems={[
        { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
        { href: '/server/tasks', label: t('server.tasks.title', 'Tasks') },
        ...(orderAmendmentsV1 && translations.ready
          ? [{ href: '/server/orders', label: t('serverOrders.title', 'Orders'), active: true }]
          : []),
        { href: '/server/takeaway', label: t('server.takeaway.link') },
      ]}
      className={styles.shell}
    >
      <div className={styles.workspace}>
        {!translations.ready && (
          <output className={styles.state} aria-live="polite" aria-atomic="true">
            {translations.failed
              ? t('error_unexpected', 'Order details language could not be loaded. Please try again.')
              : t('common.loading', 'Loading…')}
          </output>
        )}
        {translations.failed && (
          <button type="button" className={styles.control} onClick={translations.retry}>
            {t('retry', 'Retry')}
          </button>
        )}
        {translations.ready && !orderAmendmentsV1 && (
          <p className={styles.state} role="note">
            {t('orderAmendments.feature_disabled', 'Order amendments are not enabled for this restaurant.')}
          </p>
        )}
        {translations.ready && (
          <header className={styles.header}>
            <div>
              <p>
                {t('serverOrders.title', 'Orders')} · {visibleOrder ? typeCopy(visibleOrder.type, t) : ''}
              </p>
              <h1>{visibleOrder?.orderNumber ?? t('serverOrders.order_detail', 'Order details')}</h1>
            </div>
            <Link className={styles.control} href="/server/orders">
              {t('serverOrders.back_to_orders', 'Back to orders')}
            </Link>
          </header>
        )}
        {translations.ready && isLoading && (
          <output className={styles.state} aria-live="polite" aria-atomic="true">
            {t('serverOrders.loading', 'Loading orders…')}
          </output>
        )}
        {translations.ready && error && (
          <p className={styles.error} role="alert">
            {error.startsWith('orderAmendments.')
              ? t(error, t('serverOrders.load_failed', 'Orders are unavailable.'))
              : error}
          </p>
        )}
        {visibleOrder && (
          <>
            <MarketplaceOrderSource source={visibleOrder.externalOrder} />
            <section className={styles.summary} aria-label={t('serverOrders.order_summary', 'Order summary')}>
              <div className={styles.summaryHeading}>
                <OrderStatusBadge status={visibleOrder.status} />
                <span>
                  {t('orderAmendments.payment_state', 'Payment')}: {visibleOrder.paymentStatus}
                </span>
                <strong>{formatOrderCurrency(visibleOrder.total, visibleOrder)}</strong>
              </div>
              <dl className={styles.details}>
                <div>
                  <dt>{t('serverOrders.order_type', 'Order type')}</dt>
                  <dd>{typeCopy(visibleOrder.type, t)}</dd>
                </div>
                <div>
                  <dt>{t('cashier.workspace.customer', 'Customer')}</dt>
                  <dd dir="auto">{visibleOrder.customerName || t('cashier.workspace.guest', 'Guest')}</dd>
                </div>
                <div>
                  <dt>{t('serverOrders.order_number', 'Order number')}</dt>
                  <dd>{visibleOrder.orderNumber}</dd>
                </div>
                <div>
                  <dt>{t('serverOrders.order_version', 'Current version')}</dt>
                  <dd>{visibleOrder.version}</dd>
                </div>
                {visibleOrder.tableLabel && (
                  <div>
                    <dt>{t('server.table', 'Table')}</dt>
                    <dd dir="auto">{visibleOrder.tableLabel}</dd>
                  </div>
                )}
              </dl>
              {visitAction}
            </section>
            <section className={styles.items} aria-labelledby="server-order-items-title">
              <h2 id="server-order-items-title">{t('orderAmendments.original_order', 'Original order')}</h2>
              {visibleOrder.items.map((item) => (
                <article key={item.id} className={styles.item}>
                  <strong>
                    {item.quantity}×{' '}
                    {item.productName || item.menuName || t('orderAmendments.catalog_item', 'Catalog item')}
                  </strong>
                  <OrderLineSummary line={orderItemToLineSummary(item)} />
                </article>
              ))}
            </section>
            <OrderAmendmentHistorySection
              orderId={visibleOrder.id}
              refreshKey={reloadKey}
              onResolutionChanged={refreshOrder}
            />
            <section className={styles.action} aria-label={t('orderAmendments.actions', 'Order actions')}>
              <OrderAmendmentEntryButton
                order={visibleOrder}
                operatorRole="Server"
                showFeatureDisabledNotice={false}
                onCommitted={refreshOrder}
              />
            </section>
          </>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}
