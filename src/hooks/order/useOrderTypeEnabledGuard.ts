'use client';

import { useEffect } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import { hasStoredTableGuestState } from '@/services/tableGuestVisitStorage';

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
 * Deliberately does NOT run while `loading`: acting on the temporary empty snapshot would clear a
 * guest's persisted choice during revalidation. Only a confirmed successful empty response clears
 * the choice; an unverified read keeps it for recovery while the picker and checkout stay blocked.
 */
export function useOrderTypeEnabledGuard(): void {
  const { state, setOrderType, clearOrderType } = useOrderType();
  const { enabled, loading, confirmed } = useEnabledOrderTypes();

  useEffect(() => {
    if (loading) return;

    // A stored table visit (or unresolved round descriptor) owns its channel. Do not clear the
    // pinned Dine-In choice just because the restaurant is temporarily closed; the visit surface
    // will hold new rounds and restore Dine-In when the public availability read permits it.
    if (hasStoredTableGuestState()) return;

    // A successful empty response means no public order type is currently available. Clear the
    // persisted choice so a deep link to checkout cannot keep submitting the previously selected
    // channel. A failed read is distinguished by `confirmed: false`; keep the choice but do not
    // expose a checkout affordance until availability is verified.
    if (enabled.length === 0) {
      if (confirmed && state.orderType !== null) clearOrderType();
      return;
    }

    // G4 — the stored choice is no longer offered.
    if (state.orderType !== null && !enabled.includes(state.orderType)) {
      clearOrderType();
      return;
    }

    // G8 — exactly one type on offer and nothing chosen yet.
    if (state.orderType === null && enabled.length === 1) {
      setOrderType(enabled[0]);
    }
  }, [enabled, loading, confirmed, state.orderType, setOrderType, clearOrderType]);
}
