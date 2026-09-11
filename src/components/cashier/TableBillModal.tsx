'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { PaymentMethod } from '@/types/order';
import TableBillLines from './TableBillLines';
import type { AddPaymentRequest } from '@/services/cashierService';
import { formatPlainCurrency } from '@/utils/currency';
import { billTenderSchema } from '@/schemas/tableBill.schema';
import type { useTableBill } from '@/hooks/cashier/useTableBill';
import styles from './TableBillModal.module.css';
import { usePaymentOperationKey } from '@/hooks/cashier/usePaymentOperationKey';

interface TableBillModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly billState: ReturnType<typeof useTableBill>;
  readonly onSuccess: (message: string) => void;
}

type BillTender = Pick<AddPaymentRequest, 'paymentMethod' | 'amount'>;

/**
 * The one-bill-per-table dialog (waiter/POS). Shows the table's WHOLE bill —
 * every ordering round the guests made, grouped per order — and takes ONE
 * tender against it, which the backend spreads across the open orders
 * oldest-round-first. This is the till answering "what does table 7 owe and
 * settle it", not "manage order ORD-1042".
 */
export default function TableBillModal({ isOpen, onClose, billState, onSuccess }: TableBillModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { operationFor, resetOperation } = usePaymentOperationKey();

  const { bill, tableNumberInput, setTableNumberInput, isLoading, isPaying, error } = billState;
  const remaining = bill?.remaining ?? 0;

  const handleClose = () => {
    setAmount('');
    setMethod(PaymentMethod.Cash);
    setValidationError(null);
    billState.reset();
    onClose();
  };

  const handleLoadBill = () => {
    setAmount('');
    billState.loadBill();
  };

  const handleConfirm = async () => {
    if (!bill) return;
    const parsed = billTenderSchema.safeParse({ amount, paymentMethod: method });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setValidationError(null);
    const tender: BillTender = { amount: parsed.data.amount, paymentMethod: parsed.data.paymentMethod };
    const ok = await billState.payBill({ ...tender, operationId: operationFor() });
    if (ok) {
      resetOperation();
      onSuccess(t('cashier.table_bill.payment_applied', { amount: parsed.data.amount.toFixed(2) }));
      setAmount('');
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} title={t('cashier.table_bill.title', 'Table bill')} size="lg">
      <div className={styles.loadRow}>
        <FormField label={t('cashier.table_bill.table_number', 'Table number')} className={styles.tableField}>
          <input
            type="number"
            min={1}
            className="form-input"
            value={tableNumberInput}
            onChange={(e) => setTableNumberInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLoadBill();
            }}
          />
        </FormField>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleLoadBill}
          disabled={isLoading || !billState.hasValidTable}
        >
          {isLoading ? t('cashier.table_bill.loading', 'Loading...') : t('cashier.table_bill.load', 'Load bill')}
        </button>
      </div>

      {(error || validationError) && (
        <div className="alert alert-error">
          {error && <div>{error}</div>}
          {validationError && <div>{t(validationError)}</div>}
        </div>
      )}

      {bill && (
        <>
          <div className={styles.billScroll}>
            <TableBillLines bill={bill} />
          </div>

          <div className={styles.totals} aria-live="polite">
            <div className={styles.totalsRow}>
              <span>{t('cashier.table_bill.orders_count', 'Orders')}</span>
              <span>{bill.orderCount}</span>
            </div>
            <div className={styles.totalsRow}>
              <span>{t('cashier.table_bill.total', 'Bill total')}</span>
              <span>{formatPlainCurrency(bill.total)}</span>
            </div>
            <div className={styles.totalsRow}>
              <span>{t('cashier.table_bill.paid', 'Paid')}</span>
              <span>{formatPlainCurrency(bill.totalPaid)}</span>
            </div>
            <div className={`${styles.totalsRow} ${styles.remainingRow}`}>
              <span>{t('cashier.table_bill.remaining', 'Remaining')}</span>
              <span>{formatPlainCurrency(remaining)}</span>
            </div>
          </div>

          <div className={styles.payRow}>
            <FormField label={t('cashier.payment_amount', 'Payment Amount')} className={styles.amountField}>
              <input
                type="number"
                min={0}
                step="0.01"
                max={remaining}
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  resetOperation();
                }}
                disabled={isPaying || remaining <= 0}
              />
            </FormField>
            <FormField label={t('cashier.payment_method', 'Payment Method')} className={styles.methodField}>
              <select
                className="form-select"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  resetOperation();
                }}
                disabled={isPaying || remaining <= 0}
              >
                <option value={PaymentMethod.Cash}>💵 {t('cashier.table_bill.method_cash', 'Cash')}</option>
                <option value={PaymentMethod.CreditCard}>
                  💳 {t('cashier.table_bill.method_credit_card', 'Credit Card')}
                </option>
                <option value={PaymentMethod.DebitCard}>
                  💳 {t('cashier.table_bill.method_debit_card', 'Debit Card')}
                </option>
                <option value={PaymentMethod.MobilePayment}>
                  📱 {t('cashier.table_bill.method_mobile', 'Mobile Payment')}
                </option>
              </select>
            </FormField>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={isPaying || remaining <= 0 || !amount || Number.parseFloat(amount) <= 0}
            >
              {isPaying
                ? t('cashier.table_bill.loading', 'Loading...')
                : t('cashier.table_bill.add_payment', 'Add payment')}
            </button>
          </div>
        </>
      )}
    </BaseModal>
  );
}
