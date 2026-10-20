import { useEffect, useState } from 'react';
import { currentOrderTicket } from '@/lib/currentOrderTicket';
import { getCurrentStaffTicket } from '@/services/currentStaffTicketService';
import type { OrderDto } from '@/types/order';

/** Read current group contents independently of the collapsed, redacted amendment history. */
export function useCurrentOrderTicket(order: OrderDto | null, related: readonly OrderDto[] | undefined) {
  const [generation, setGeneration] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; orders: OrderDto[]; error: boolean }>();
  const revision = [order, ...(related ?? [])].map((value) => `${value?.id}:${value?.version}`).join(',');
  const key = `${order?.id}:${revision}:${generation}`;
  const orderId = order?.id;
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    void getCurrentStaffTicket(orderId).then(
      (orders) => {
        if (active) setLoaded({ key, orders, error: false });
      },
      () => {
        if (active) setLoaded({ key, orders: [], error: true });
      },
    );
    return () => {
      active = false;
    };
  }, [orderId, key]);
  const current = loaded?.key === key ? loaded : undefined;
  return {
    ticket: order ? currentOrderTicket(order, current?.orders ?? related) : null,
    loading: Boolean(orderId && !current),
    error: current?.error ?? false,
    refresh: () => setGeneration((value) => value + 1),
  };
}
