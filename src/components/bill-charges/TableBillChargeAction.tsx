'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';
import FormField from '@/components/design-system/FormField';
import type { OrderDto } from '@/types/order';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import BillChargeConfigurationNotice from './BillChargeConfigurationNotice';
import OrderBillChargeAction from './OrderBillChargeAction';

export default function TableBillChargeAction({
  orders,
  disabled,
  onUpdated,
  onBusyChange,
}: Readonly<{
  orders: readonly OrderDto[];
  disabled: boolean;
  onUpdated: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
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
    } catch (error: unknown) {
      // Pending discovery is advisory; the editor owns the visible storage error and write lock.
      void error;
      /* The action owns storage error handling. */
    }
  }
  const available = reader.configuration?.rules.some(
    (rule) =>
      rule.enabled &&
      (role === 'admin' || rule.roles.some((value) => value.toLowerCase() === role)) &&
      eligible.some((order) => rule.orderTypes.some((value) => value === order.type)),
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
        <FormField label={t('billCharges.order')}>
          <select value={order.id} disabled={disabled} onChange={(event) => setSelected(event.target.value)}>
            {eligible.map((value) => (
              <option value={value.id} key={value.id}>
                {getOrderDisplayNumber(value)}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <OrderBillChargeAction
        key={order.id}
        order={order}
        disabled={disabled}
        onUpdated={onUpdated}
        onBusyChange={onBusyChange}
      />
    </div>
  );
}
