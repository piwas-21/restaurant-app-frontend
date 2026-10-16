'use client';
import { useEffect, useState } from 'react';
import { useOptionalAuth } from '@/components/AuthContext';
import { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';
import type { OrderDto } from '@/types/order';
import BillChargeConfigurationNotice from './BillChargeConfigurationNotice';
import OrderBillChargeEditor from './OrderBillChargeEditor';
import OrderBillCharges from './OrderBillCharges';

export default function OrderBillChargeAction(
  props: Readonly<{
    order: OrderDto;
    disabled: boolean;
    onBusyChange?: (busy: boolean) => void;
    onUpdated: () => void | Promise<void>;
  }>,
) {
  const auth = useOptionalAuth();
  const reader = useBillChargeConfiguration();
  const [hasPending, setHasPending] = useState(false);
  const actor = auth?.user?.userId;
  const role = auth?.user?.role?.toLowerCase();
  useEffect(() => {
    try {
      setHasPending(!!actor && sessionStorage.getItem(`staff.bill-charge:${actor}:${props.order.id}`) !== null);
    } catch (_error: unknown) {
      // Pending discovery is advisory; the editor owns the visible storage error and write lock.
      setHasPending(false);
    }
  }, [actor, props.order.id, props.order.version]);
  const available = reader.configuration?.rules.some(
    (rule) =>
      rule.enabled &&
      (rule.orderTypes as readonly string[]).includes(props.order.type) &&
      (role === 'admin' || rule.roles.some((value) => value.toLowerCase() === role)) &&
      !props.order.billCharges?.some((charge) => charge.key === rule.key),
  );
  if (!available && !hasPending)
    return (
      <>
        <BillChargeConfigurationNotice reader={reader} />
        <OrderBillCharges charges={props.order.billCharges} />
      </>
    );
  return <OrderBillChargeEditor {...props} />;
}
