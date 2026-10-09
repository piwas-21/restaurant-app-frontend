'use client';

import { useCheckoutPrereqGuard } from './useCheckoutPrereqGuard';
import { useCheckoutTableGuestState } from '@/contexts/CheckoutTableGuestStateContext';
import { OrderType } from '@/types/order';

interface TableGuestCheckoutOptions {
  readonly orderType: string | null | undefined;
  readonly hasConfirmedOrder: boolean;
}

export default function useTableGuestCheckout({ orderType, hasConfirmedOrder }: TableGuestCheckoutOptions) {
  const tableVisit = useCheckoutTableGuestState();
  const isDineIn = orderType === OrderType.DineIn;
  // The admitted visit is the source of truth even if another tab or old local checkout state left
  // a stale Takeaway/Delivery choice. It must never fall through to ordinary order placement.
  const isTableGuestRound = tableVisit.phase === 'active';
  const isTableVisitLoading = tableVisit.phase === 'loading' && (isDineIn || tableVisit.hasPendingRound);
  const isTableVisitBlocked = ['ended', 'unavailable', 'storageUnavailable'].includes(tableVisit.phase);
  const hasAcknowledgement = tableVisit.hasAcknowledgement;
  const { isMissingPrereqs } = useCheckoutPrereqGuard(
    hasConfirmedOrder || isTableVisitLoading || isTableVisitBlocked || hasAcknowledgement,
    {
      active: isTableGuestRound,
      loading: isTableVisitLoading,
      blocked: isTableVisitBlocked,
      hasPendingRound: tableVisit.hasPendingRound,
    },
  );

  return {
    isTableGuestRound,
    isTableVisitLoading,
    isTableVisitBlocked,
    hasPendingRound: tableVisit.hasPendingRound,
    tableGuestVisitPhase: tableVisit.phase,
    isLoading:
      isTableVisitLoading || (isMissingPrereqs && !hasConfirmedOrder && !isTableVisitBlocked && !hasAcknowledgement),
  };
}
