'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';
import { ReceiptText } from 'lucide-react';
import controls from './BillChargeControls.module.css';
import styles from './BillCharges.module.css';
import type { OrderDto } from '@/types/order';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import BillChargeConfigurationNotice from './BillChargeConfigurationNotice';
import OrderBillChargeAction from './OrderBillChargeAction';

export default function TableBillChargeAction({
  orders,
  disabled,
  onUpdated,
  onBusyChange,
  onDraftChange,
}: Readonly<{
  orders: readonly OrderDto[];
  disabled: boolean;
  onUpdated: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onDraftChange?: (blocked: boolean) => void;
}>) {
  const { t } = useTranslation();
  const auth = useOptionalAuth();
  const reader = useBillChargeConfiguration();
  const role = auth?.user?.role?.toLowerCase();
  const [selected, setSelected] = useState('');
  const eligible = orders.filter((order) => !order.externalOrder && !['Cancelled', 'Refunded'].includes(order.status));
  let pendingOrderId: string | null = null;
  if (typeof window !== 'undefined' && auth?.user?.userId) {
    try {
      pendingOrderId =
        orders.find((value) => sessionStorage.getItem(`staff.bill-charge:${auth.user?.userId}:${value.id}`))?.id ??
        null;
    } catch (_error: unknown) {
      // Pending discovery is advisory; the editor owns the visible storage error and write lock.
      /* The action owns storage error handling. */
    }
  }
  const available = reader.configuration?.rules.some(
    (rule) =>
      rule.enabled &&
      (role === 'admin' || rule.roles.some((value) => value.toLowerCase() === role)) &&
      eligible.some((order) => (rule.orderTypes as readonly string[]).includes(order.type)),
  );
  const order =
    orders.find((value) => value.id === pendingOrderId) ??
    eligible.find((value) => value.id === selected) ??
    eligible[0];
  if (!order) return null;
  if (!available && !pendingOrderId && !eligible.some((value) => value.billCharges?.length))
    return <BillChargeConfigurationNotice reader={reader} />;
  return (
    <div>
      {eligible.length > 1 && !pendingOrderId && (
        <fieldset className={`${styles.form} ${controls.group}`}>
          <legend className={styles.help}>{t('billCharges.order')}</legend>
          <div className={controls.chips}>
            {eligible.map((value) => (
              <button
                type="button"
                className={controls.chip}
                disabled={disabled}
                aria-pressed={order.id === value.id}
                key={value.id}
                onClick={() => setSelected(value.id)}
              >
                <ReceiptText size={16} aria-hidden="true" />
                {t('billCharges.orderNumber', { number: getOrderDisplayNumber(value) })}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <OrderBillChargeAction
        key={order.id}
        order={order}
        disabled={disabled}
        onUpdated={onUpdated}
        onBusyChange={onBusyChange}
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
