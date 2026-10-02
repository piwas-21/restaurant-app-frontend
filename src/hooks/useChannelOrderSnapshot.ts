'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderDto } from '@/types/order';
import { getOrderById } from '@/services/order/orderQueries';

/** Read-only detail refresh: does not close a ticket or announce a mutation success. */
export function useChannelOrderSnapshot(order: OrderDto) {
  const [snapshot, setSnapshot] = useState(order);
  const [refreshError, setRefreshError] = useState<{ orderId: string; error: unknown } | null>(null);
  const mounted = useRef(true);
  const activeId = useRef(order.id);
  const generation = useRef(0);
  if (activeId.current !== order.id) {
    activeId.current = order.id;
    generation.current += 1;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshOrder = useCallback(() => {
    const id = order.id;
    const current = ++generation.current;
    setRefreshError(null);
    void getOrderById(id)
      .then((fresh) => {
        if (!mounted.current || activeId.current !== id || generation.current !== current || fresh.id !== id) return;
        setSnapshot((previous) => (previous.id === id && previous.version > fresh.version ? previous : fresh));
      })
      .catch((error: unknown) => {
        if (mounted.current && activeId.current === id && generation.current === current)
          setRefreshError({ orderId: id, error });
      });
  }, [order.id]);

  return {
    order: snapshot.id === order.id && snapshot.version >= order.version ? snapshot : order,
    refreshOrder,
    refreshError: refreshError?.orderId === order.id ? refreshError.error : null,
  };
}
