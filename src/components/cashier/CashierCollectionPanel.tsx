'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { canCollectPayment } from '@/lib/settlementEligibility';
import { formatOrderCurrency, orderCurrency } from '@/lib/cashierMoney';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StatusBadge from '@/components/design-system/StatusBadge';
import CashierCollectionForm from './CashierCollectionForm';
import CashierCollectionPaymentHistory from './CashierCollectionPaymentHistory';
import CashierCollectionSuccess from './CashierCollectionSuccess';
import { paymentModalSchema } from './paymentModalSchema';
import { usePaymentOperationKey } from '@/hooks/cashier/usePaymentOperationKey';
import styles from './CashierCollection.module.css';

interface CashierCollectionPanelProps {
  readonly order: OrderDto;
  readonly isPending: boolean;
  readonly isCheckingPayment: boolean;
  readonly onSubmit: (payment: AddPaymentRequest) => Promise<OrderDto>;
  readonly onBack: () => void;
  readonly onNextSale: () => void;
  readonly onReturnToOrder: () => void;
}

type LastPayment = { readonly applied: number; readonly change: number; readonly remaining: number };

const initialAmount = (order: OrderDto): string => (order.remainingAmount > 0 ? order.remainingAmount.toFixed(2) : '');

function errorText(error: unknown, t: (key: string) => string): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('cashier.')) return t(message);
  return message || t('cashier.payment_failed');
}

/** Focused tender surface. It records money already taken; it never charges a terminal. */
export default function CashierCollectionPanel({
  order,
  isPending,
  isCheckingPayment,
  onSubmit,
  onBack,
  onNextSale,
  onReturnToOrder,
}: CashierCollectionPanelProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(() => initialAmount(order));
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [received, setReceived] = useState(() => initialAmount(order));
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<LastPayment | null>(null);
  const orderIdRef = useRef(order.id);
  const { operationFor, resetOperation } = usePaymentOperationKey();

  useEffect(() => {
    if (orderIdRef.current === order.id) return;
    orderIdRef.current = order.id;
    const nextAmount = initialAmount(order);
    setAmount(nextAmount);
    setReceived(nextAmount);
    setMethod(PaymentMethod.Cash);
    setTransactionId('');
    setNotes('');
    setError(null);
    setLastPayment(null);
    resetOperation();
  }, [order, resetOperation]);

  const clearTransient = useCallback(() => {
    resetOperation();
    setError(null);
    setLastPayment(null);
  }, [resetOperation]);

  const handleAmountChange = useCallback(
    (value: string) => {
      if (Number.isNaN(Number.parseFloat(value)) && value !== '') return;
      setAmount(value);
      if (method === PaymentMethod.Cash) setReceived(value);
      clearTransient();
    },
    [clearTransient, method],
  );

  const handleReceivedChange = useCallback((value: string) => setReceived(value), []);
  const handleCashSuggestion = useCallback((value: number) => {
    setReceived(value.toFixed(2));
    setError(null);
  }, []);
  const handleSetAmount = useCallback(
    (value: number) => {
      const next = value.toFixed(2);
      handleAmountChange(next);
    },
    [handleAmountChange],
  );
  const handleMethodChange = useCallback(
    (value: string) => {
      setMethod(value);
      clearTransient();
    },
    [clearTransient],
  );
  const handleTransactionChange = useCallback(
    (value: string) => {
      setTransactionId(value);
      clearTransient();
    },
    [clearTransient],
  );
  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      clearTransient();
    },
    [clearTransient],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPending || !canCollectPayment(order)) return;
      const parsed = paymentModalSchema.safeParse({ amount, paymentMethod: method, cashReceived: received });
      if (!parsed.success) {
        const invalidField = parsed.error.issues[0]?.path[0];
        setError(
          invalidField === 'cashReceived' ? t('cashier.cash_received_too_low') : t('cashier.payment_amount_required'),
        );
        return;
      }
      if (parsed.data.amount > order.remainingAmount) {
        setError(t('cashier.payment_exceeds_balance'));
        return;
      }
      setError(null);
      const applied = parsed.data.amount;
      const cashReceived = Number.parseFloat(received) || 0;
      try {
        const updated = await onSubmit({
          operationId: operationFor(),
          amount: applied,
          paymentMethod: method,
          transactionId: transactionId.trim() || undefined,
          paymentNotes: notes.trim() || undefined,
        });
        const nextAmount = initialAmount(updated);
        setLastPayment({
          applied,
          change: method === PaymentMethod.Cash ? Math.max(0, cashReceived - applied) : 0,
          remaining: Math.max(0, updated.remainingAmount),
        });
        setAmount(nextAmount);
        setReceived(nextAmount);
        setMethod(PaymentMethod.Cash);
        setTransactionId('');
        setNotes('');
        setError(null);
        resetOperation();
      } catch (reason: unknown) {
        setError(errorText(reason, t));
      }
    },
    [amount, isPending, method, notes, onSubmit, operationFor, order, received, resetOperation, t, transactionId],
  );

  const due = order.remainingAmount;

  return (
    <section className={styles.collection} aria-labelledby="cashier-collection-title">
      <header className={styles.collectionHeader}>
        <button type="button" className={styles.backButton} onClick={onBack} disabled={isPending}>
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
        <div className={styles.statuses}>
          <OrderStatusBadge status={order.status} />
          <StatusBadge tone="neutral">{paymentStatusLabel(order.paymentStatus, t)}</StatusBadge>
        </div>
      </header>

      <div className={styles.balanceCard} aria-live="polite">
        <span>{t('cashier.workspace.amount_due')}</span>
        <strong>{formatOrderCurrency(due, order)}</strong>
        <small>{t('cashier.collection.currency', { currency: orderCurrency(order) })}</small>
      </div>

      {isCheckingPayment && (
        <div className={styles.pendingNotice} role="status">
          <StatusBadge tone="info">{t('cashier.payment_checking')}</StatusBadge>
          <span>{t('cashier.collection.pending')}</span>
        </div>
      )}

      <div className={styles.collectionGrid}>
        <CashierCollectionForm
          order={order}
          amount={amount}
          received={received}
          method={method}
          transactionId={transactionId}
          notes={notes}
          error={error}
          isPending={isPending}
          isCheckingPayment={isCheckingPayment}
          onSubmit={handleSubmit}
          onAmountChange={handleAmountChange}
          onReceivedChange={handleReceivedChange}
          onMethodChange={handleMethodChange}
          onTransactionChange={handleTransactionChange}
          onNotesChange={handleNotesChange}
          onSetMaxAmount={() => handleSetAmount(Math.max(0, due))}
          onExactCash={() => setReceived(amount)}
          onCashSuggestion={handleCashSuggestion}
          t={t}
          onReturnToOrder={onReturnToOrder}
        />
        <CashierCollectionPaymentHistory order={order} />
      </div>

      {lastPayment && (
        <CashierCollectionSuccess
          order={order}
          payment={lastPayment}
          onNextSale={onNextSale}
          onReturnToOrder={onReturnToOrder}
        />
      )}
    </section>
  );
}
