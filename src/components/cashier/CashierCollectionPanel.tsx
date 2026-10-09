'use client';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { orderCurrency, formatOrderCurrency } from '@/lib/cashierMoney';
import type { PendingPaymentOperation } from '@/lib/cashierPendingPayment';
import type { CashierCollectionPaymentOutcome } from '@/hooks/cashier/useCashierCollectionForm.types';
import { useCashierCollectionForm } from '@/hooks/cashier/useCashierCollectionForm';
import CashierCollectionForm from './CashierCollectionForm';
import CashierStatusBadges from './CashierStatusBadges';
import CashierCollectionPaymentHistory from './CashierCollectionPaymentHistory';
import CashierCollectionSuccess from './CashierCollectionSuccess';
import CashierPendingPaymentNotice from './CashierPendingPaymentNotice';
import styles from './CashierCollection.module.css';

interface CashierCollectionPanelProps {
  readonly order: OrderDto;
  readonly isPending: boolean;
  readonly isBusy?: boolean;
  readonly isCheckingPayment: boolean;
  readonly pendingPayment?: PendingPaymentOperation | null;
  readonly recoveryError?: string | null;
  readonly recoveryOrderId?: string | null;
  readonly onOpenRecoveryOrder?: (orderId: string) => void;
  readonly recoveredPayment?: CashierCollectionPaymentOutcome | null;
  readonly onSubmit: (payment: AddPaymentRequest, cashReceivedMinor?: number) => Promise<OrderDto>;
  readonly onBack: () => void;
  readonly onNextSale: () => void;
  readonly onReturnToOrder: () => void;
  readonly onRetryPendingPayment?: () => Promise<void>;
  readonly onPrintReceipt?: (order: OrderDto) => void;
}

export default function CashierCollectionPanel({
  order,
  isPending,
  isBusy = false,
  isCheckingPayment,
  pendingPayment,
  recoveryError = null,
  recoveryOrderId = null,
  onOpenRecoveryOrder,
  recoveredPayment = null,
  onSubmit,
  onBack,
  onNextSale,
  onReturnToOrder,
  onRetryPendingPayment = async () => undefined,
  onPrintReceipt = () => undefined,
}: CashierCollectionPanelProps) {
  const { t, i18n } = useTranslation();
  const form = useCashierCollectionForm({
    order,
    isPending,
    pendingPayment,
    recoveredPayment,
    onSubmit,
    locale: i18n.language || 'en',
    t,
  });
  const due = order.remainingAmount;

  return (
    <section className={styles.collection} aria-labelledby="cashier-collection-title">
      <header className={styles.collectionHeader}>
        <button type="button" className={styles.backButton} onClick={onBack} disabled={form.controlsDisabled}>
          <ArrowLeft size={18} aria-hidden="true" />
          {t('cashier.collection.back_orders')}
        </button>
        <div className={styles.orderIdentity}>
          <p className={styles.eyebrow}>{t('cashier.collection.order')}</p>
          <h1 id="cashier-collection-title" dir="auto">
            {order.orderNumber}
          </h1>
          <p>{t('cashier.collection.description', { order: order.orderNumber })}</p>
        </div>
        <CashierStatusBadges order={order} />
      </header>
      <div className={styles.balanceCard} aria-live="polite">
        <span>{t('cashier.workspace.amount_due')}</span>
        <strong>{formatOrderCurrency(due, order)}</strong>
        <small>{t('cashier.collection.currency', { currency: orderCurrency(order) })}</small>
      </div>
      {pendingPayment && pendingPayment.status !== 'Refused' && (
        <CashierPendingPaymentNotice
          pendingPayment={pendingPayment}
          isBusy={isPending || isCheckingPayment}
          onRetry={() => void onRetryPendingPayment()}
          t={t}
        />
      )}
      {recoveryError && !pendingPayment && (
        <div className={styles.formError} role="alert" aria-live="polite">
          <p>{t(recoveryError)}</p>
          {recoveryOrderId && onOpenRecoveryOrder ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => onOpenRecoveryOrder(recoveryOrderId)}
            >
              {t('cashier.payment_recovery_open_order')}
            </button>
          ) : (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void onRetryPendingPayment()}
              disabled={isBusy || isCheckingPayment}
            >
              {t('cashier.collection.retry_payment_check')}
            </button>
          )}
        </div>
      )}
      <div className={styles.collectionGrid}>
        <CashierCollectionForm
          order={order}
          amount={form.amount}
          tip={form.tip}
          tipValid={form.tipValid}
          received={form.received}
          method={form.method}
          transactionId={form.transactionId}
          notes={form.notes}
          error={form.error}
          isPending={form.controlsDisabled}
          isBusy={isBusy}
          isCheckingPayment={isCheckingPayment}
          onSubmit={form.onSubmit}
          onAmountChange={form.onAmountChange}
          onTipChange={form.onTipChange}
          onTipValidityChange={form.onTipValidityChange}
          onReceivedChange={form.onReceivedChange}
          onMethodChange={form.onMethodChange}
          onTransactionChange={form.onTransactionChange}
          onNotesChange={form.onNotesChange}
          onSetMaxAmount={form.onSetMaxAmount}
          onExactCash={form.onExactCash}
          onCashSuggestion={form.onCashSuggestion}
          locale={i18n.language || 'en'}
          t={t}
          onReturnToOrder={onReturnToOrder}
        />
        <CashierCollectionPaymentHistory order={order} />
      </div>
      {form.lastPayment && (
        <CashierCollectionSuccess
          order={order}
          payment={form.lastPayment}
          onNextSale={onNextSale}
          onReturnToOrder={onReturnToOrder}
          onPrintReceipt={onPrintReceipt}
        />
      )}
    </section>
  );
}
