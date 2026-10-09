'use client';

import { useCallback, useMemo, useRef, useState, type MutableRefObject, type SetStateAction } from 'react';
import type { CashierOrderGroupDto } from '@/types/cashier';
import type { OrderDto } from '@/types/order';

export function useCashierOrderGroupState(dataRevisionRef: MutableRefObject<number>) {
  const [groups, setGroups] = useState<CashierOrderGroupDto[]>([]);
  const ordersRef = useRef<OrderDto[]>([]);
  const groupsRef = useRef<CashierOrderGroupDto[]>([]);

  const replaceGroups = useCallback(
    (nextGroups: CashierOrderGroupDto[]) => {
      groupsRef.current = nextGroups;
      ordersRef.current = nextGroups.flatMap((group) => group.orders);
      setGroups(nextGroups);
      dataRevisionRef.current += 1;
    },
    [dataRevisionRef],
  );

  const updateOrders = useCallback(
    (updater: SetStateAction<OrderDto[]>) => {
      dataRevisionRef.current += 1;
      const nextOrders = typeof updater === 'function' ? updater(ordersRef.current) : updater;
      const nextById = new Map(nextOrders.map((order) => [order.id.toLowerCase(), order]));
      const nextGroups = groupsRef.current
        .map((group) => ({
          ...group,
          orders: group.orders
            .map((order) => nextById.get(order.id.toLowerCase()))
            .filter((order): order is OrderDto => order !== undefined),
        }))
        .filter((group) => group.orders.length > 0);

      ordersRef.current = nextOrders;
      groupsRef.current = nextGroups;
      setGroups(nextGroups);
    },
    [dataRevisionRef],
  );

  return {
    groups,
    orders: useMemo(() => groups.flatMap((group) => group.orders), [groups]),
    replaceGroups,
    updateOrders,
  };
}
