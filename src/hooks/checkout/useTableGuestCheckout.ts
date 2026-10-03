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
  const isTableGuestRound = isDineIn && tableVisit.phase === 'active';
  const isTableVisitLoading = tableVisit.phase === 'loading' && (isDineIn || tableVisit.hasPendingRound);
  const isTableVisitBlocked = isDineIn && ['ended', 'unavailable', 'storageUnavailable'].includes(tableVisit.phase);
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
