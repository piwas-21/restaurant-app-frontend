'use client';

import type { Ref } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CreditCard, FileText, MapPin, ShoppingBag, User } from 'lucide-react';
import { formatPlainCurrency } from '@/utils/currency';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import type { OrderDto } from '@/types/order';
import { PaymentRows, TicketItems } from './CashierReadOnlyTicketSections';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './CashierWorkspaceTicket.module.css';

interface CashierReadOnlyTicketProps {
  readonly order: OrderDto | null;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onBack?: () => void;
  readonly timeZone?: string;
  readonly backButtonRef?: Ref<HTMLButtonElement>;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  readonly stateRef?: Ref<HTMLDivElement>;
}

function amountDue(order: OrderDto): number {
  if (typeof order.remainingAmount === 'number') return order.remainingAmount;
  return order.total - order.totalPaid;
}

function formatDate(value: string, language: string, timeZone: string | undefined, t: TFunction): string {
  return formatCashierDateTime(value, language, timeZone, 'medium', t('cashier.workspace.unknown_time'));
}

function channelLabel(type: string, t: TFunction): string {
  if (type === 'DineIn') return t('cashier.workspace.channel_dine_in');
  if (type === 'Takeaway') return t('cashier.workspace.channel_takeaway');
  if (type === 'Delivery') return t('cashier.workspace.channel_delivery');
  return t('cashier.workspace.channel_unknown');
}

export default function CashierReadOnlyTicket({
  order,
  isLoading = false,
  error,
  onBack,
  timeZone,
  backButtonRef,
  headingRef,
  stateRef,
}: CashierReadOnlyTicketProps) {
  const { t, i18n } = useTranslation();
  const backButton = onBack ? (
    <button type="button" ref={backButtonRef} className={styles.backButton} onClick={onBack}>
      {t('cashier.workspace.back_to_list')}
    </button>
  ) : null;

  if (isLoading) {
    return (
      <div ref={stateRef} className={styles.ticketState} tabIndex={-1}>
        {backButton}
        <output>{t('cashier.workspace.order_loading')}</output>
      </div>
    );
  }
  if (error) {
    return (
      <div ref={stateRef} className={`${styles.ticketState} ${styles.ticketError}`} role="alert" tabIndex={-1}>
        {backButton}
        <p>{error === 'cashier.workspace.order_unavailable' ? t(error) : error}</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div ref={stateRef} className={styles.ticketState} tabIndex={-1}>
        {t('cashier.workspace.select_order')}
      </div>
    );
  }

  const due = amountDue(order);
  return (
    <article className={styles.ticket} aria-labelledby="cashier-ticket-title">
      {backButton}
      <header className={styles.ticketHeader}>
        <div>
          <p className={styles.eyebrow}>{t('cashier.workspace.order_details')}</p>
          <h2 id="cashier-ticket-title" ref={headingRef} tabIndex={-1} dir="auto">
            {order.orderNumber}
          </h2>
          <time dateTime={order.orderDate}>{formatDate(order.orderDate, i18n.language, timeZone, t)}</time>
        </div>
        <div className={styles.ticketBadges}>
          <OrderStatusBadge status={order.status} />
          <StatusBadge tone="neutral">{paymentStatusLabel(order.paymentStatus, t)}</StatusBadge>
        </div>
      </header>

      <dl className={styles.ticketMeta}>
        <div>
          <dt>
            <User size={16} aria-hidden="true" />
            {t('cashier.workspace.customer')}
          </dt>
          <dd dir="auto">{order.customerName || t('cashier.workspace.guest')}</dd>
        </div>
        <div>
          <dt>{t('cashier.workspace.channel')}</dt>
          <dd>{channelLabel(order.type, t)}</dd>
        </div>
        {order.tableNumber !== undefined && (
          <div>
            <dt>{t('cashier.workspace.table')}</dt>
            <dd>{t('cashier.workspace.table_value', { table: order.tableNumber })}</dd>
          </div>
        )}
        {order.deliveryAddress && (
          <div>
            <dt>
              <MapPin size={16} aria-hidden="true" />
              {t('cashier.workspace.delivery_address')}
            </dt>
            <dd dir="auto">{order.deliveryAddress.fullAddress}</dd>
          </div>
        )}
      </dl>

      <section className={styles.ticketSection} aria-labelledby="cashier-ticket-items">
        <h3 id="cashier-ticket-items">
          <ShoppingBag size={18} aria-hidden="true" />
          {t('cashier.workspace.items')}
        </h3>
        <TicketItems items={order.items ?? []} t={t} />
      </section>

      {order.notes && (
        <section className={styles.ticketSection}>
          <h3>
            <FileText size={18} aria-hidden="true" />
            {t('cashier.workspace.notes')}
          </h3>
          <p className={styles.notes} dir="auto">
            {order.notes}
          </p>
        </section>
      )}

      <section className={styles.ticketSection} aria-labelledby="cashier-ticket-payment">
        <h3 id="cashier-ticket-payment">
          <CreditCard size={18} aria-hidden="true" />
          {t('cashier.workspace.payment')}
        </h3>
        <div className={styles.moneyRows}>
          <div>
            <span>{t('cashier.workspace.order_total')}</span>
            <strong>{formatPlainCurrency(order.total)}</strong>
          </div>
          <div>
            <span>{t('cashier.workspace.total_paid')}</span>
            <strong>{formatPlainCurrency(order.totalPaid)}</strong>
          </div>
          <div className={styles.moneyTotal}>
            <span>
              {due > 0
                ? t('cashier.workspace.amount_due')
                : due < 0
                  ? t('cashier.workspace.credit')
                  : t('cashier.workspace.settled')}
            </span>
            <strong>{formatPlainCurrency(Math.abs(due))}</strong>
          </div>
        </div>
        <PaymentRows payments={order.payments ?? []} t={t} />
      </section>
    </article>
  );
}
