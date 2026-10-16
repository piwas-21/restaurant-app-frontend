'use client';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { useOrderBillChargeAction } from '@/hooks/useOrderBillChargeAction';
import type { OrderDto } from '@/types/order';
import BillChargeFields from './BillChargeFields';
import OrderBillCharges from './OrderBillCharges';
import styles from './BillCharges.module.css';

export default function OrderBillChargeEditor({
  order,
  disabled,
  onUpdated,
  onBusyChange,
}: Readonly<{
  order: OrderDto;
  disabled: boolean;
  onBusyChange?: (busy: boolean) => void;
  onUpdated: () => void | Promise<void>;
}>) {
  const { t } = useTranslation();
  const action = useOrderBillChargeAction(order, disabled, onUpdated, onBusyChange);
  const { values, setValues, busy, failed, message, pending, storageBlocked, hydrated, save } = action;
  const positive = values.filter((value) => value.amount > 0);
  const terminal = !!order.externalOrder || ['Cancelled', 'Refunded'].includes(order.status);
  if (terminal && !pending) return null;
  return (
    <div className={styles.action}>
      <OrderBillCharges charges={order.billCharges} />
      {!terminal && (
        <BillChargeFields
          orderType={order.type}
          values={values}
          disabled={disabled || busy || pending !== null || !hydrated || storageBlocked}
          existingKeys={order.billCharges?.map((charge) => charge.key)}
          onChange={setValues}
        />
      )}
      {positive.length > 0 && (
        <StaffButton
          disabled={busy || (disabled && !pending) || !hydrated || storageBlocked}
          onClick={() => void save()}
        >
          {t(pending ? 'billCharges.checkSave' : 'billCharges.add')}
        </StaffButton>
      )}
      {storageBlocked && <p role="alert">{t('billCharges.saveFailed')}</p>}
      {failed && <p role="alert">{message ?? t('billCharges.saveFailed')}</p>}
    </div>
  );
}
