'use client';

import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CreditCard, FileText, MapPin, ShoppingBag, User } from 'lucide-react';
import { formatPlainCurrency } from '@/utils/currency';
import { orderStatusPresentation } from '@/lib/orderStatusPresentation';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import type { OrderDto } from '@/types/order';
import { PaymentRows, TicketItems } from './CashierReadOnlyTicketSections';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './CashierWorkspaceTicket.module.css';

interface CashierReadOnlyTicketProps {
  readonly order: OrderDto | null;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onBack?: () => void;
}

function amountDue(order: OrderDto): number {
  if (typeof order.remainingAmount === 'number') return order.remainingAmount;
  return order.total - order.totalPaid;
}

function formatDate(value: string, language: string, t: TFunction): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t('cashier.workspace.unknown_time')
    : date.toLocaleString(language || 'en', { dateStyle: 'medium', timeStyle: 'short' });
}

function channelLabel(type: string, t: TFunction): string {
  if (type === 'DineIn') return t('cashier.workspace.channel_dine_in');
  if (type === 'Takeaway') return t('cashier.workspace.channel_takeaway');
  if (type === 'Delivery') return t('cashier.workspace.channel_delivery');
  return t('cashier.workspace.channel_unknown');
}

export default function CashierReadOnlyTicket({ order, isLoading = false, error, onBack }: CashierReadOnlyTicketProps) {
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return <output className={styles.ticketState}>{t('cashier.workspace.order_loading')}</output>;
  }
  if (error) {
    return (
      <div className={`${styles.ticketState} ${styles.ticketError}`} role="alert">
        <p>{error === 'cashier.workspace.order_unavailable' ? t(error) : error}</p>
      </div>
    );
  }
  if (!order) {
    return <div className={styles.ticketState}>{t('cashier.workspace.select_order')}</div>;
  }

  const status = orderStatusPresentation(order.status, t);
  const due = amountDue(order);
  return (
    <article className={styles.ticket} aria-labelledby="cashier-ticket-title">
      {onBack && (
        <button type="button" className={styles.backButton} onClick={onBack}>
          {t('cashier.workspace.back_to_list')}
        </button>
      )}
      <header className={styles.ticketHeader}>
        <div>
          <p className={styles.eyebrow}>{t('cashier.workspace.order_details')}</p>
          <h2 id="cashier-ticket-title">{order.orderNumber}</h2>
          <time dateTime={order.orderDate}>{formatDate(order.orderDate, i18n.language, t)}</time>
        </div>
        <div className={styles.ticketBadges}>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <StatusBadge tone="neutral">{paymentStatusLabel(order.paymentStatus, t)}</StatusBadge>
        </div>
      </header>

      <dl className={styles.ticketMeta}>
        <div>
          <dt>
            <User size={16} aria-hidden="true" />
            {t('cashier.workspace.customer')}
          </dt>
          <dd>{order.customerName || t('cashier.workspace.guest')}</dd>
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
            <dd>{order.deliveryAddress.fullAddress}</dd>
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
          <p className={styles.notes}>{order.notes}</p>
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
