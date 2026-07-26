'use client';

import { useEffect } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';

/**
 * Keeps the persisted order type honest about what the restaurant currently offers
 * (ORDER-TYPE-AVAILABILITY-PLAN gaps G4 and G8).
 *
 * **G4 — a persisted choice can point at a type that is no longer on offer.** The enabled list is
 * fetched once per page load and the picker simply stops rendering the button
 * (`OrderTypeToggleShell`), so an admin disabling Delivery — or Dine-in closing at 22:00, which
 * `OrderTypeConfigurationService` strips dynamically — hid the button but left the guest's stored
 * `Delivery` in force, filtering the menu and driving checkout toward a channel that cannot be
 * fulfilled. Clearing it drops them back to the no-type browse state, which is where a guest with
 * no valid choice belongs.
 *
 * **G8 — a single-channel restaurant made the guest click anyway.** A delivery-only tenant showed
 * one button and left the whole menu in the no-type state until it was pressed. With exactly one
 * type on offer there is no decision to make, so it is selected for them.
 *
 * @remarks
 * Deliberately does NOT run while `loading`: the hook starts at `enabled: []`, and acting on that
 * would clear every guest's choice on every page load. It is also deliberately permissive on
 * failure — `useEnabledOrderTypes` falls back to all three types, so an outage never strips a
 * valid choice.
 */
export function useOrderTypeEnabledGuard(): void {
  const { state, setOrderType, clearOrderType } = useOrderType();
  const { enabled, loading } = useEnabledOrderTypes();

  useEffect(() => {
    if (loading || enabled.length === 0) return;

    // G4 — the stored choice is no longer offered.
    if (state.orderType !== null && !enabled.includes(state.orderType)) {
      clearOrderType();
      return;
    }

    // G8 — exactly one type on offer and nothing chosen yet.
    if (state.orderType === null && enabled.length === 1) {
      setOrderType(enabled[0]);
    }
  }, [enabled, loading, state.orderType, setOrderType, clearOrderType]);
}
