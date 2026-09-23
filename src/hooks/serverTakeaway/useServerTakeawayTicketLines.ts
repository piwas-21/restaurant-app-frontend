'use client';

import { useCallback, useState } from 'react';
import type { OrderItem } from '@/components/catalog/orderItems';

interface RemovedLine {
  readonly item: OrderItem;
  readonly index: number;
}

export function useServerTakeawayTicketLines(
  items: readonly OrderItem[],
  mutate: (change: (current: OrderItem[]) => OrderItem[]) => void,
) {
  const [lastRemoved, setLastRemoved] = useState<RemovedLine | null>(null);
  const setItemQuantity = useCallback(
    (index: number, quantity: number) =>
      mutate((current) =>
        quantity <= 0
          ? current.filter((_, itemIndex) => itemIndex !== index)
          : current.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity } : item)),
      ),
    [mutate],
  );
  const removeItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      setLastRemoved({ item, index });
      mutate((current) => current.filter((_, itemIndex) => itemIndex !== index));
    },
    [items, mutate],
  );
  const undoRemove = useCallback(() => {
    if (!lastRemoved) return;
    const removal = lastRemoved;
    setLastRemoved(null);
    mutate((current) => {
      const next = [...current];
      next.splice(Math.min(removal.index, next.length), 0, removal.item);
      return next;
    });
  }, [lastRemoved, mutate]);

  return { lastRemoved, setItemQuantity, removeItem, undoRemove };
}
