'use client';

import { useCallback, useEffect } from 'react';
import { OrderType } from '@/types/order';
import { useTableGuestDineInAvailability } from '@/hooks/checkout/useTableGuestDineInAvailability';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

interface OrderTypeSelection {
  readonly orderType: OrderType | null;
  readonly table: string;
}

interface PinnedTableContext {
  readonly tableId: string | null;
  readonly tableNumber: string | null;
}

/** Restores the channel and table number from a verified active visit, never the legacy picker. */
export function useTableGuestOrderTypeRecovery({
  orderType,
  tableContext,
  setOrderType,
  setTable,
}: {
  readonly orderType: OrderTypeSelection;
  readonly tableContext: PinnedTableContext;
  readonly setOrderType: (type: OrderType) => void;
  readonly setTable: (table: string) => void;
}) {
  const tableGuest = useTableGuestDineInAvailability();

  useEffect(() => {
    if (!tableGuest.active || !tableGuest.dineInAvailable) return;
    if (orderType.orderType !== OrderType.DineIn) setOrderType(OrderType.DineIn);
    if (
      tableGuest.visit?.tableId &&
      tableContext.tableId === tableGuest.visit.tableId &&
      tableContext.tableNumber &&
      orderType.table !== tableContext.tableNumber
    ) {
      setTable(tableContext.tableNumber);
    }
  }, [
    orderType.orderType,
    orderType.table,
    setOrderType,
    setTable,
    tableContext.tableId,
    tableContext.tableNumber,
    tableGuest.active,
    tableGuest.dineInAvailable,
    tableGuest.visit?.tableId,
  ]);

  const commitActiveVisitDineIn = useCallback(() => {
    if (!tableGuest.active) return false;
    if (
      tableGuest.dineInAvailable &&
      tableGuest.visit?.tableId &&
      tableContext.tableId === tableGuest.visit.tableId &&
      tableContext.tableNumber
    ) {
      setTable(tableContext.tableNumber);
    }
    return true;
  }, [
    setTable,
    tableContext.tableId,
    tableContext.tableNumber,
    tableGuest.active,
    tableGuest.dineInAvailable,
    tableGuest.visit?.tableId,
  ]);

  const selectActiveVisitDineIn = useCallback(
    (source: string) => {
      if (!tableGuest.active || !tableGuest.dineInAvailable) return false;
      if (!commitActiveVisitDineIn()) return false;
      setOrderType(OrderType.DineIn);
      trackEvent('order_type_selected', {
        orderType: OrderType.DineIn,
        source,
        loggedIn: isLoggedInForAnalytics(),
      });
      return true;
    },
    [commitActiveVisitDineIn, setOrderType, tableGuest.active, tableGuest.dineInAvailable],
  );

  return { tableGuest, commitActiveVisitDineIn, selectActiveVisitDineIn } as const;
}
