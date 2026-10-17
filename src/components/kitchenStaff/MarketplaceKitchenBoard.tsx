'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { useAuth } from '@/components/AuthContext';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';
import OrderCard from '@/components/server/OrderCard';
import { useMarketplaceKitchenOrders } from '@/hooks/useMarketplaceKitchenOrders';
import styles from './MarketplaceKitchenBoard.module.css';
import KitchenBoardTools from './native/KitchenBoardTools';
import { useKitchenBoardView } from '@/hooks/kitchenBoard/useKitchenBoardView';
import { useTenantToday } from '@/hooks/useTenantToday';

type MarketplaceAudience = 'kitchen' | 'server';
const noLocalStatusChange = (_orderId: string, _status: string) => undefined;

function isMarketplaceStaffRole(orderRole: string | undefined, audience: MarketplaceAudience): boolean {
  const role = orderRole?.toLowerCase();
  return role === 'admin' || (audience === 'kitchen' ? role === 'kitchenstaff' : role === 'server');
}

export default function MarketplaceKitchenBoard({
  audience = 'kitchen',
  workspace = false,
  navigation,
}: Readonly<{ audience?: MarketplaceAudience; workspace?: boolean; navigation?: ReactNode }>) {
  const { t } = useTranslation();
  const router = useTenantLocaleRouter();
  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();
  const authorized = isMarketplaceStaffRole(user?.role, audience);
  const today = useTenantToday();
  const { orders, isLoading, error, isStale, refresh } = useMarketplaceKitchenOrders(
    !authLoading && authorized && !!today,
    today,
  );
  const workOrders = useMemo(
    () =>
      orders
        .filter((order) => order.businessDate === today)
        .map((order) => ({
          orderId: order.id,
          orderNumber: order.orderNumber,
          dailyOrderNumber: order.dailyOrderNumber,
          tableLabel: order.tableLabel ?? null,
          tableNumber: order.tableNumber ?? null,
          status: order.status,
          isCompleted: false,
          type: order.type,
          createdAt: order.orderDate,
          items: order.items,
          source: order,
        })),
    [orders, today],
  );
  const view = useKitchenBoardView(workOrders, [], !isLoading && !error);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push(tenantLocaleHref(pathname, '/auth/login'));
    else if (!authorized) router.push(tenantLocaleHref(pathname, '/'));
  }, [authLoading, authorized, pathname, router, user]);

  if (authLoading || (user && !authorized)) {
    return (
      <section className={styles.board} aria-busy="true">
        <p className={styles.state}>{t('loading')}</p>
      </section>
    );
  }
  if (!user) return null;

  return (
    <section
      className={workspace ? `${styles.board} ${styles.workspace}` : styles.board}
      aria-label={t('marketplaceStaff.kitchen_title')}
    >
      <KitchenBoardTools view={view} navigation={navigation} loading={isLoading} refresh={() => void refresh()} />

      {isStale && (
        <div className={styles.state} role="alert">
          <span>{t('marketplaceStaff.kitchen_stale')}</span>
          <button type="button" className={styles.refresh} onClick={() => void refresh()}>
            {t('marketplaceStaff.retry')}
          </button>
        </div>
      )}
      {isLoading && orders.length === 0 && <p className={styles.state}>{t('loading')}</p>}
      {!isLoading && !error && view.visibleOrders.length === 0 && (
        <p className={styles.state}>{t('marketplaceStaff.kitchen_filter_empty')}</p>
      )}
      {error && orders.length === 0 && (
        <div className={styles.state} role="alert">
          <span>{t('marketplaceStaff.kitchen_error')}</span>
          <button type="button" className={styles.refresh} onClick={() => void refresh()}>
            {t('marketplaceStaff.retry')}
          </button>
        </div>
      )}
      {view.visibleOrders.length > 0 && (
        <div className={styles.list}>
          {view.visibleOrders.map(({ source: order }) => (
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
