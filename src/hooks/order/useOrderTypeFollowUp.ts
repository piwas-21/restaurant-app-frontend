'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { OrderType } from '@/types/order';

/** Which follow-up modal to display after a type is picked. */
export type OrderTypeFollowUp = 'table' | 'address' | null;

interface FollowUpState {
  /**
   * Which follow-up modal is currently open: 'table' for dine-in,
   * 'address' for delivery, null when nothing is open.
   */
  followUp: OrderTypeFollowUp;
  /**
   * Pick a type. For Takeaway this is a one-shot commit (no detail
   * needed); for DineIn/Delivery this commits the type AND opens the
   * relevant detail modal so the user can capture the table/address
   * before checkout.
   */
  pickType: (type: OrderType) => void;
  closeFollowUp: () => void;
}

/**
 * Owns the order-type picking flow exposed by the cart sidebar
 * (BUGS-IMPROVEMENTS-PLAN §C1.5.c). Replaces the earlier
 * welcome-modal-on-page-load pattern; the user now browses freely and
 * picks/changes type via the sidebar toggle whenever they want.
 *
 *   1. QR-scan landings (table context present) → auto-pin DineIn + the
 *      scanned table number on first mount. No modal pops.
 *   2. Sidebar order-type toggle → `pickType(type)` commits the type
 *      to OrderTypeContext and opens the relevant detail modal
 *      (TableSelectionModal for dine-in, DeliveryAddressModal for
 *      delivery, no modal for takeaway).
 *   3. Modal Confirm captures the detail; Cancel leaves the type set
 *      with empty detail (recoverable: user can re-click the toggle).
 */
export function useOrderTypeFollowUp(): FollowUpState {
  const { hasChosenOrderType, setOrderType, setTable } = useOrderType();
  const { hasTableContext, tableContext } = useTableContext();
  const [followUp, setFollowUp] = useState<OrderTypeFollowUp>(null);

  // QR-scan landing → pin DineIn + the scanned table.
  useEffect(() => {
    if (hasTableContext && tableContext.tableNumber && !hasChosenOrderType) {
      setOrderType(OrderType.DineIn);
      setTable(tableContext.tableNumber);
    }
  }, [hasTableContext, tableContext.tableNumber, hasChosenOrderType, setOrderType, setTable]);

  const pickType = useCallback(
    (type: OrderType) => {
      setOrderType(type);
      if (type === OrderType.DineIn) {
        setFollowUp('table');
      } else if (type === OrderType.Delivery) {
        setFollowUp('address');
      } else {
        // Takeaway has no detail to capture.
        setFollowUp(null);
      }
    },
    [setOrderType],
  );

  const closeFollowUp = useCallback(() => setFollowUp(null), []);

  return { followUp, pickType, closeFollowUp };
}
