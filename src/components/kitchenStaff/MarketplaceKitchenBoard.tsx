'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { useAuth } from '@/components/AuthContext';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';
import type { OrderDto } from '@/types/order';
import OrderCard from '@/components/server/OrderCard';
import { useMarketplaceKitchenOrders } from '@/hooks/useMarketplaceKitchenOrders';
import styles from './MarketplaceKitchenBoard.module.css';

type KitchenStatusFilter = 'all' | 'Confirmed' | 'Preparing' | 'Ready';
const STATUS_FILTERS: readonly KitchenStatusFilter[] = ['all', 'Confirmed', 'Preparing', 'Ready'];

const noLocalStatusChange = (_orderId: string, _status: string) => undefined;

function isKitchenStaffRole(orderRole: string | undefined): boolean {
  const role = orderRole?.toLowerCase();
  return role === 'kitchenstaff' || role === 'admin';
}

export default function MarketplaceKitchenBoard() {
  const { t } = useTranslation();
  const router = useTenantLocaleRouter();
  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();
  const { orders, isLoading, error, isStale, refresh } = useMarketplaceKitchenOrders(
    !authLoading && isKitchenStaffRole(user?.role),
  );
  const [filter, setFilter] = useState<KitchenStatusFilter>('all');
  const authorized = isKitchenStaffRole(user?.role);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push(tenantLocaleHref(pathname, '/auth/login'));
    else if (!authorized) router.push(tenantLocaleHref(pathname, '/'));
  }, [authLoading, authorized, pathname, router, user]);

  const visibleOrders = useMemo(
    () => (filter === 'all' ? orders : orders.filter((order) => order.status === filter)),
    [filter, orders],
  );
  const countFor = (status: KitchenStatusFilter) =>
    status === 'all' ? orders.length : orders.filter((order) => order.status === status).length;

  if (authLoading || (user && !authorized)) {
    return (
      <section className={styles.board} aria-busy="true">
        <p className={styles.state}>{t('marketplaceStaff.loading')}</p>
      </section>
    );
  }
  if (!user) return null;

  return (
    <section className={styles.board} aria-labelledby="marketplace-kitchen-title">
      <header className={styles.header}>
        <div>
          <h1 id="marketplace-kitchen-title" className={styles.title}>
            {t('marketplaceStaff.kitchen_title')}
          </h1>
          <p className={styles.description}>{t('marketplaceStaff.kitchen_description')}</p>
        </div>
        <button type="button" className={styles.refresh} onClick={() => void refresh()} disabled={isLoading}>
          {t('marketplaceStaff.refresh')}
        </button>
      </header>

      <div className={styles.filters} role="group" aria-label={t('marketplaceStaff.kitchen_filter')}>
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            className={styles.filter}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {t(`marketplaceStaff.status.${status}`)}
            <span className={styles.count}>{countFor(status)}</span>
          </button>
        ))}
      </div>

      {isStale && (
        <div className={styles.state} role="alert">
          <span>{t('marketplaceStaff.kitchen_stale')}</span>
          <button type="button" className={styles.refresh} onClick={() => void refresh()}>
            {t('marketplaceStaff.retry')}
          </button>
        </div>
      )}
      {isLoading && orders.length === 0 && <p className={styles.state}>{t('marketplaceStaff.loading')}</p>}
      {!isLoading && !error && visibleOrders.length === 0 && (
        <p className={styles.state}>
          {t(filter === 'all' ? 'marketplaceStaff.kitchen_empty' : 'marketplaceStaff.kitchen_filter_empty')}
        </p>
      )}
      {error && orders.length === 0 && (
        <div className={styles.state} role="alert">
          <span>{t('marketplaceStaff.kitchen_error')}</span>
          <button type="button" className={styles.refresh} onClick={() => void refresh()}>
            {t('marketplaceStaff.retry')}
          </button>
        </div>
      )}
      {visibleOrders.length > 0 && (
        <div className={styles.list}>
          {visibleOrders.map((order: OrderDto) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={noLocalStatusChange}
              onOrderChanged={() => void refresh()}
            />
          ))}
        </div>
      )}
    </section>
  );
}
