'use client';

import type { Ref } from 'react';
import dynamic from 'next/dynamic';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CreditCard, FileText, MapPin, RefreshCw, ShoppingBag, User } from 'lucide-react';
import MarketplaceOrderSource from '@/components/order/MarketplaceOrderSource';
import { orderCurrency } from '@/lib/cashierMoney';
import { canCollectPayment } from '@/lib/settlementEligibility';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import type { OrderDto } from '@/types/order';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import PreparationCountdown from '@/components/order/PreparationCountdown';
import { PaymentRows, TicketItems, TicketMoneySummary } from './CashierReadOnlyTicketSections';
import technicalReferenceStyles from './CashierTechnicalReference.module.css';
import CashierStatusBadges from './CashierStatusBadges';
import viewStyles from './CashierWorkspaceView.module.css';
import styles from './CashierWorkspaceTicket.module.css';

// Printing, focus, notes, and approval are needed only after an operator selects a ticket.
// Keep their PDF and modal dependencies out of the queue's initial route bundle.
const CashierTicketActions = dynamic(() => import('./CashierTicketActions'));

interface CashierReadOnlyTicketProps {
  readonly order: OrderDto | null;
  readonly historyOrders?: readonly OrderDto[];
  readonly onSelectHistoryOrder?: (orderId: string) => void;
  readonly isLoading?: boolean;
  readonly isRefreshing?: boolean;
  readonly error?: string | null;
  readonly onRefresh?: () => void;
  readonly onBack?: () => void;
  readonly onCollect?: (orderId: string) => void;
  /** Notifies the host that a ticket action mutated the order, so it can refresh its data. */
  readonly onOrderChanged?: () => void;
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
  historyOrders,
  onSelectHistoryOrder,
  isLoading = false,
  isRefreshing = false,
  error,
  onRefresh,
  onBack,
  onCollect,
  onOrderChanged,
  timeZone,
  backButtonRef,
  headingRef,
  stateRef,
}: CashierReadOnlyTicketProps) {
  const { t, i18n } = useTranslation();
  const backButton = onBack ? (
    <button
      type="button"
      ref={backButtonRef}
      className={`${styles.backButton} ${viewStyles.backButton}`}
      onClick={onBack}
    >
      <ArrowLeft size={17} aria-hidden="true" />
      {t('cashier.workspace.back_to_list')}
    </button>
  ) : null;
  const errorContent = error ? (
    <>
      <p>{error === 'cashier.workspace.order_unavailable' ? t(error) : error}</p>
      {onRefresh && (
        <button type="button" className={styles.collectButton} onClick={onRefresh}>
          <RefreshCw size={17} aria-hidden="true" />
          {t('cashier.workspace.retry')}
        </button>
      )}
    </>
  ) : null;

  if (isLoading) {
    return (
      <div ref={stateRef} className={styles.ticketState} tabIndex={-1}>
        {backButton}
        <output>{t('cashier.workspace.order_loading')}</output>
      </div>
    );
  }
  if (error && !order) {
    return (
      <div ref={stateRef} className={`${styles.ticketState} ${styles.ticketError}`} role="alert" tabIndex={-1}>
        {backButton}
        {errorContent}
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
  const isSnapshotFresh = !isLoading && !isRefreshing && !error;
  return (
    <article className={styles.ticket} aria-labelledby="cashier-ticket-title">
      {backButton}
      {isRefreshing && <output>{t('cashier.workspace.order_loading')}</output>}
      {error && (
        <div className={styles.ticketError} role="alert">
          {errorContent}
        </div>
      )}
      <header className={styles.ticketHeader}>
        <div>
          <p className={styles.eyebrow}>{t('cashier.workspace.order_details')}</p>
          <h2 id="cashier-ticket-title" ref={headingRef} tabIndex={-1} dir="auto">
            {getOrderDisplayNumber(order)}
          </h2>
          <time dateTime={order.orderDate}>{formatDate(order.orderDate, i18n.language, timeZone, t)}</time>
          <PreparationCountdown
            status={order.status}
            expectedReadyAt={order.expectedReadyAt}
            effectivePreparationMinutes={order.effectivePreparationMinutes}
            timeZone={order.businessTimeZoneId ?? timeZone}
          />
        </div>
        <CashierStatusBadges order={order} />
      </header>

      <details className={technicalReferenceStyles.details}>
        <summary>{t('cashier.workspace.technical_reference')}</summary>
        <p>
          {t('order_number')}: <code>{order.orderNumber}</code>
        </p>
        <p>
          {t('cashier.workspace.technical_reference')}: <code>{order.id}</code>
        </p>
      </details>

      <MarketplaceOrderSource source={order.externalOrder} />
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
        <TicketItems items={order.items ?? []} currency={orderCurrency(order)} t={t} />
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

      <CashierTicketActions
        order={order}
        onOrderChanged={onOrderChanged}
        isOrderSnapshotFresh={isSnapshotFresh}
        historyOrders={historyOrders}
        onSelectHistoryOrder={onSelectHistoryOrder}
      />
      <section className={styles.ticketSection} aria-labelledby="cashier-ticket-payment">
        <h3 id="cashier-ticket-payment">
          <CreditCard size={18} aria-hidden="true" />
          {t('cashier.workspace.payment')}
        </h3>
        <TicketMoneySummary order={order} due={due} t={t} />
        <PaymentRows payments={order.payments ?? []} currency={orderCurrency(order)} t={t} />
        {onCollect &&
          (canCollectPayment(order) || (order.serviceSessionId && historyOrders?.some(canCollectPayment))) && (
            <button type="button" className={styles.collectButton} onClick={() => onCollect(order.id)}>
              <CreditCard size={18} aria-hidden="true" />
              {t('cashier.collection.title')}
            </button>
          )}
      </section>
    </article>
  );
}
