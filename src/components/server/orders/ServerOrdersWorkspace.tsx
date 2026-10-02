'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from '@/components/TenantLink';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { getServerAmendmentOrders } from '@/services/server/orders';
import { OrderType, type OrderDto } from '@/types/order';
import type { PagedResult } from '@/types/order/common';
import { getErrorMessage } from '@/utils/apiClient';
import styles from './ServerOrdersWorkspace.module.css';

type TypeFilter = OrderType | 'All';
const PAGE_SIZE = 50;
const TYPE_FILTERS: readonly TypeFilter[] = ['All', OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];

function typeLabel(type: TypeFilter, t: (key: string, fallback: string) => string): string {
  if (type === 'All') return t('serverOrders.all_types', 'All types');
  let key: string;
  switch (type) {
    case OrderType.DineIn:
      key = 'order_type_dine_in';
      break;
    case OrderType.Takeaway:
      key = 'order_type_takeaway';
      break;
    case OrderType.Delivery:
      key = 'order_type_delivery';
      break;
  }
  return t(key, type);
}

export default function ServerOrdersWorkspace() {
  const { t } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const [type, setType] = useState<TypeFilter>('All');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<PagedResult<OrderDto> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void getServerAmendmentOrders(type, page, PAGE_SIZE, search)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(getErrorMessage(reason) ?? 'serverOrders.load_failed');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderAmendmentsV1, page, search, type]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <StaffWorkspaceShell
      navItems={[
        { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
        { href: '/server/tasks', label: t('server.tasks.title', 'Tasks') },
        ...(orderAmendmentsV1
          ? [{ href: '/server/orders', label: t('serverOrders.title', 'Orders'), active: true }]
          : []),
        { href: '/server/takeaway', label: t('server.takeaway.link') },
      ]}
      className={styles.shell}
    >
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <h1>{t('serverOrders.title', 'Orders')}</h1>
            {orderAmendmentsV1 && (
              <p>
                {t(
                  'serverOrders.description',
                  'Find a Dine In, Takeaway, or Delivery order and review its current details before making a change.',
                )}
              </p>
            )}
          </div>
        </header>
        {!orderAmendmentsV1 && (
          <p className={styles.state} role="note">
            {t('orderAmendments.feature_disabled', 'Order amendments are not enabled for this restaurant.')}
          </p>
        )}
        <form className={styles.searchForm} onSubmit={submitSearch}>
          <FormField label={t('serverOrders.search_label', 'Search order or customer')}>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} autoComplete="off" />
          </FormField>
          <button type="submit" className={styles.control}>
            {t('serverOrders.search', 'Search')}
          </button>
          {search && (
            <button
              type="button"
              className={styles.control}
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
            >
              {t('serverOrders.clear_search', 'Clear search')}
            </button>
          )}
        </form>
        <div
          className={styles.filters}
          role="group"
          aria-label={t('serverOrders.filter_by_type', 'Filter by order type')}
        >
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={styles.filterButton}
              aria-pressed={type === filter}
              onClick={() => {
                setType(filter);
                setPage(1);
              }}
            >
              {typeLabel(filter, t)}
            </button>
          ))}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error.startsWith('serverOrders.') ? t(error) : error}
          </p>
        )}
        {isLoading && (
          <p className={styles.state} role="status">
            {t('serverOrders.loading', 'Loading orders…')}
          </p>
        )}
        {!isLoading && result?.items.length === 0 && (
          <p className={styles.state}>{t('serverOrders.empty', 'No orders match these filters.')}</p>
        )}
        <div className={styles.orderList} aria-busy={isLoading}>
          {result?.items.map((order) => (
            <article key={order.id} className={styles.orderRow}>
              <div className={styles.orderIdentity}>
                <strong dir="auto">{order.orderNumber}</strong>
                <span>{typeLabel(order.type as TypeFilter, t)}</span>
                {order.tableLabel && (
                  <span dir="auto">
                    {t('server.table', 'Table')} {order.tableLabel}
                  </span>
                )}
                {order.customerName && <span dir="auto">{order.customerName}</span>}
              </div>
              <div className={styles.orderState}>
                <OrderStatusBadge status={order.status} />
                <span>{order.paymentStatus}</span>
                <strong>{formatOrderCurrency(order.total, order)}</strong>
              </div>
              <Link className={styles.openOrder} href={`/server/orders/${encodeURIComponent(order.id)}`}>
                {t('serverOrders.open_order', 'Review order')}
              </Link>
            </article>
          ))}
        </div>
        {result && result.totalPages > 1 && (
          <nav className={styles.pagination} aria-label={t('serverOrders.pagination', 'Order pages')}>
            <button
              type="button"
              className={styles.control}
              onClick={() => setPage((value) => value - 1)}
              disabled={page <= 1 || isLoading}
            >
              {t('serverOrders.previous', 'Previous')}
            </button>
            <span>
              {t('serverOrders.page_of', 'Page {{page}} of {{total}}', { page: result.page, total: result.totalPages })}
            </span>
            <button
              type="button"
              className={styles.control}
              onClick={() => setPage((value) => value + 1)}
              disabled={!result.hasNextPage || isLoading}
            >
              {t('serverOrders.next', 'Next')}
            </button>
          </nav>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}
