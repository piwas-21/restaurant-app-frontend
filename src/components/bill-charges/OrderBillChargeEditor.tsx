'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { useOrderBillChargeAction } from '@/hooks/useOrderBillChargeAction';
import { billChargeItemBasis, billChargePreview } from '@/lib/billChargePreview';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import type { OrderDto } from '@/types/order';
import BillChargeFields from './BillChargeFields';
import OrderBillCharges from './OrderBillCharges';
import styles from './BillCharges.module.css';

export default function OrderBillChargeEditor({
  order,
  disabled,
  onUpdated,
  onBusyChange,
  onDraftChange,
}: Readonly<{
  order: OrderDto;
  disabled: boolean;
  onBusyChange?: (busy: boolean) => void;
  onDraftChange?: (blocked: boolean) => void;
  onUpdated: () => void | Promise<void>;
}>) {
  const { t } = useTranslation();
  const [valid, setValid] = useState(true);
  const action = useOrderBillChargeAction(order, disabled, onUpdated, onBusyChange);
  const { values, setValues, busy, failed, message, pending, storageBlocked, hydrated, save } = action;
  const positive = values.filter((value) => value.amount > 0);
  useEffect(() => {
    onDraftChange?.(values.length > 0 || !valid);
    return () => onDraftChange?.(false);
  }, [onDraftChange, valid, values.length]);
  const terminal = !!order.externalOrder || ['Cancelled', 'Refunded'].includes(order.status);
  if (terminal && !pending) return null;
  return (
    <div className={styles.action}>
      <OrderBillCharges charges={order.billCharges} />
      <p className={styles.help}>
        {t('billCharges.selectedItemBasis', { amount: formatOrderCurrency(billChargeItemBasis(order), order) })}
      </p>
      {!terminal && (
        <BillChargeFields
          orderType={order.type}
          hasCapturedPayment={
            order.totalPaid > 0 ||
            order.payments?.some((payment) => ['Completed', 'PartiallyRefunded', 'Refunded'].includes(payment.status))
          }
          hasFrozenTax={order.tax !== 0}
          values={values}
          disabled={disabled || busy || pending !== null || !hydrated || storageBlocked}
          existingKeys={order.billCharges?.map((charge) => charge.key)}
          onChange={setValues}
          onValidityChange={setValid}
        />
      )}
      {values.length > 0 && (
        <p className={styles.help}>
          {t(positive.length > 0 ? 'billCharges.reviewBeforeSave' : 'billCharges.positiveOrRemove')}
        </p>
      )}
      {(positive.length > 0 || pending) && (
        <StaffButton
          disabled={busy || (disabled && !pending) || !hydrated || storageBlocked || (!valid && !pending)}
          onClick={() => void save()}
        >
          {pending
            ? t('billCharges.checkSave')
            : t('billCharges.applyAmount', {
                amount: formatOrderCurrency(billChargePreview(billChargeItemBasis(order), positive), order),
              })}
        </StaffButton>
      )}
      {storageBlocked && <p role="alert">{t('billCharges.saveFailed')}</p>}
      {failed && <p role="alert">{message ?? t('billCharges.saveFailed')}</p>}
    </div>
  );
}
