'use client';
import { useCallback } from 'react';
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
  readonly isCheckingPayment: boolean;
  readonly pendingPayment?: PendingPaymentOperation | null;
  readonly recoveredPayment?: CashierCollectionPaymentOutcome | null;
  readonly onSubmit: (payment: AddPaymentRequest) => Promise<OrderDto>;
  readonly onBack: () => void;
  readonly onNextSale: () => void;
  readonly onReturnToOrder: () => void;
  readonly onRetryPendingPayment?: () => Promise<void>;
  readonly onAbandonPendingPayment?: () => void;
  readonly onPrintReceipt?: (order: OrderDto) => void;
}

export default function CashierCollectionPanel({
  order,
  isPending,
  isCheckingPayment,
  pendingPayment,
  recoveredPayment = null,
  onSubmit,
  onBack,
  onNextSale,
  onReturnToOrder,
  onRetryPendingPayment = async () => undefined,
  onAbandonPendingPayment = () => undefined,
  onPrintReceipt = () => undefined,
}: CashierCollectionPanelProps) {
  const { t } = useTranslation();
  const form = useCashierCollectionForm({
    order,
    isPending,
    pendingPayment,
    recoveredPayment,
    onSubmit,
    t,
  });
  const handleAbandon = useCallback(() => {
    onAbandonPendingPayment();
    form.resetOperation();
    form.clearTransient();
  }, [form, onAbandonPendingPayment]);
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
          onAbandon={handleAbandon}
          t={t}
        />
      )}
      <div className={styles.collectionGrid}>
        <CashierCollectionForm
          order={order}
          amount={form.amount}
          received={form.received}
          method={form.method}
          transactionId={form.transactionId}
          notes={form.notes}
          error={form.error}
          isPending={form.controlsDisabled}
          isCheckingPayment={isCheckingPayment}
          onSubmit={form.onSubmit}
          onAmountChange={form.onAmountChange}
          onReceivedChange={form.onReceivedChange}
          onMethodChange={form.onMethodChange}
          onTransactionChange={form.onTransactionChange}
          onNotesChange={form.onNotesChange}
          onSetMaxAmount={form.onSetMaxAmount}
          onExactCash={form.onExactCash}
          onCashSuggestion={form.onCashSuggestion}
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
