'use client';

import { useCallback } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useCheckout } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import { needsTakeawayInfoModal } from './needsTakeawayInfoModal';
import type { OrderTypeFollowUp } from './useOrderTypeFollowUp';

interface CommitOptions {
  reservationsEnabled: boolean;
  setFollowUp: (next: OrderTypeFollowUp) => void;
  commitActiveVisitDineIn: () => boolean;
  selectActiveVisitDineIn: (source: string) => boolean;
}

export function useOrderTypeCommit({
  reservationsEnabled,
  setFollowUp,
  commitActiveVisitDineIn,
  selectActiveVisitDineIn,
}: CommitOptions) {
  const { setOrderType } = useOrderType();
  const { state: checkoutState } = useCheckout();
  // Everything after the switch is permitted: commit the type and open its detail modal. Split out
  // of `pickType` because the conflict confirm has to run it LATER, once the guest says yes.
  const commitType = useCallback(
    async (type: OrderType, source: string, forceModal: boolean) => {
      if (type === OrderType.DineIn && selectActiveVisitDineIn(source)) {
        setFollowUp(null);
        return;
      }
      setOrderType(type);
      // Funnel anchor — fires once per click, regardless of whether a
      // follow-up modal opens (the modal is a sub-step of the same intent).
      trackEvent('order_type_selected', {
        orderType: type,
        source,
        loggedIn: isLoggedInForAnalytics(),
      });
      if (type === OrderType.DineIn) {
        if (commitActiveVisitDineIn()) {
          setFollowUp(null);
          return;
        }
        // Table selection is part of the reservations experience. A tenant without that module
        // accepts a plain dine-in order through the same staff decision queue as takeaway and
        // delivery. Only a blocked checkout asks for contact details (`forceModal`).
        if (reservationsEnabled) {
          setFollowUp('table');
        } else {
          setFollowUp(forceModal ? 'dinein' : null);
        }
        return;
      }
      if (type === OrderType.Delivery) {
        setFollowUp('address');
        return;
      }

      // Takeaway: open the info modal only when something is needed (or when forced, e.g. Edit).
      if (forceModal || (await needsTakeawayInfoModal(checkoutState.customerInfo))) {
        setFollowUp('takeaway');
      } else {
        setFollowUp(null);
      }
    },
    [
      setOrderType,
      setFollowUp,
      checkoutState.customerInfo,
      reservationsEnabled,
      commitActiveVisitDineIn,
      selectActiveVisitDineIn,
    ],
  );

  return commitType;
}
