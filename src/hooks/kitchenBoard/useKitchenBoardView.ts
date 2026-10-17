'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KitchenBoardOrder, KitchenBoardCorrection } from '@/types/kitchenBoard';
import { useNotificationSound } from '@/hooks/notification/useNotificationSound';

export type KitchenView = 'active' | 'completed';
const terminal = new Set(['Completed', 'Delivered', 'Cancelled', 'Refunded', 'OutForDelivery']);
export const kitchenOrderCompleted = (order: Pick<KitchenBoardOrder, 'status' | 'isCompleted'>) =>
  order.isCompleted || terminal.has(order.status);
export function newestKitchenFirst<T extends { readonly createdAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

type ViewOrder = Pick<
  KitchenBoardOrder,
  | 'orderId'
  | 'orderNumber'
  | 'dailyOrderNumber'
  | 'tableLabel'
  | 'tableNumber'
  | 'status'
  | 'isCompleted'
  | 'type'
  | 'createdAt'
> & { readonly items: readonly { readonly productName?: string }[] };
export function useKitchenBoardView<T extends ViewOrder>(
  orders: readonly T[],
  corrections: readonly KitchenBoardCorrection[],
  loaded: boolean,
) {
  const [view, setView] = useState<KitchenView>('active');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const sound = useNotificationSound();
  const seen = useRef<Set<string> | null>(null);
  const known = useMemo(
    () => [
      ...orders.filter((o) => !kitchenOrderCompleted(o)).map((o) => o.orderId),
      ...corrections.filter((c) => !c.isCompleted && !c.withdrawn).map((c) => c.workItemId),
    ],
    [orders, corrections],
  );
  useEffect(() => {
    if (!loaded) return;
    const hasNewWork = seen.current !== null && known.some((id) => !seen.current?.has(id));
    seen.current ??= new Set();
    known.forEach((id) => seen.current?.add(id));
    if (hasNewWork) {
      if (sound.repeatUntilMouseMoves) sound.startRepeatingUntilMouseMoves();
      else sound.playNotificationSound();
    }
  }, [known, loaded, sound]);
  const query = search.trim().toLocaleLowerCase();
  const visibleOrders = newestKitchenFirst(
    orders.filter(
      (order) =>
        kitchenOrderCompleted(order) === (view === 'completed') &&
        (status === 'all' || order.status === status) &&
        (type === 'all' || order.type === type) &&
        (!query ||
          [
            order.orderNumber,
            order.dailyOrderNumber,
            order.tableLabel,
            order.tableNumber,
            ...order.items.map((item) => item.productName),
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query)),
    ),
  );
  const visibleCorrections = newestKitchenFirst(
    corrections.filter(
      (correction) =>
        (correction.isCompleted || correction.withdrawn) === (view === 'completed') &&
        (status === 'all' || correction.status === status) &&
        (type === 'all' || orders.some((order) => order.orderId === correction.orderId && order.type === type)) &&
        (!query ||
          [correction.orderNumber, correction.dailyOrderNumber, correction.tableLabel, correction.summary]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query)),
    ),
  );
  return {
    view,
    setView,
    status,
    setStatus,
    type,
    setType,
    search,
    setSearch,
    sound,
    visibleOrders,
    visibleCorrections,
    activeCount:
      orders.filter((o) => !kitchenOrderCompleted(o)).length +
      corrections.filter((c) => !c.isCompleted && !c.withdrawn).length,
    completedCount:
      orders.filter(kitchenOrderCompleted).length + corrections.filter((c) => c.isCompleted || c.withdrawn).length,
  };
}
