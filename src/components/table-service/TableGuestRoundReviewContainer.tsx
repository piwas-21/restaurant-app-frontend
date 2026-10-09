'use client';

import { useEffect } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableGuestRoundSubmission } from '@/hooks/checkout/useTableGuestRoundSubmission';
import { OrderType } from '@/types/order';
import {
  acknowledgeBasketChannelSelection,
  markBasketChannelSnapshotRefreshed,
  useBasketChannelReconciliationPending,
} from '@/hooks/order/useAssertBasketChannel';
import TableGuestRoundReview from './TableGuestRoundReview';

export default function TableGuestRoundReviewContainer({
  formatPrice,
  recoveryOnly = false,
}: Readonly<{ formatPrice: (amount: number) => string; recoveryOnly?: boolean }>) {
  const { state, clearCart, syncBasket } = useCart();
  const { state: orderTypeState } = useOrderType();
  const channelPending = useBasketChannelReconciliationPending(orderTypeState.orderType);
  const round = useTableGuestRoundSubmission({
    basket: state.basket,
    itemCount: state.items.length,
    syncBasket,
    clearCart,
  });
  const hasPendingRound = round.pendingRound !== null;
  const basketMatchesLocalItems = Boolean(
    state.basket &&
    state.items.length === state.basket.items.length &&
    state.items.every((item) => {
      const basketItem = state.basket?.items.find((candidate) => candidate.id === (item.basketItemId ?? item.id));
      return (
        basketItem &&
        basketItem.quantity === item.quantity &&
        (basketItem.specialInstructions ?? '') === (item.specialInstructions ?? '')
      );
    }),
  );
  const reviewedBasketReady = Boolean(
    state.basket &&
    orderTypeState.orderType &&
    state.basket.orderType === orderTypeState.orderType &&
    state.lastSyncedAt !== null &&
    !state.isLoading &&
    !state.isSyncing &&
    !channelPending &&
    basketMatchesLocalItems,
  );
  const basketChannelUnconfirmed = Boolean(
    !hasPendingRound &&
    !round.error &&
    !state.error &&
    state.basket &&
    state.items.length > 0 &&
    orderTypeState.orderType === OrderType.DineIn &&
    state.basket.orderType !== orderTypeState.orderType &&
    state.lastSyncedAt !== null &&
    !state.isLoading &&
    !state.isSyncing &&
    !channelPending &&
    basketMatchesLocalItems,
  );

  useEffect(() => {
    markBasketChannelSnapshotRefreshed(state.basket);
    acknowledgeBasketChannelSelection(orderTypeState.orderType);
  }, [state.basket, channelPending, orderTypeState.orderType]);

  return (
    <TableGuestRoundReview
      items={state.items}
      total={state.basket?.total ?? 0}
      isSubmitting={round.isSubmitting}
      error={round.error}
      pendingRound={round.pendingRound}
      pendingRoundUnavailable={round.pendingRoundUnavailable}
      dineInUnavailable={round.dineInUnavailable}
      onRetryAvailability={round.refreshDineInAvailability}
      acknowledgement={round.lastRoundAcknowledgement}
      recoveryOnly={recoveryOnly}
      basketChannelUnconfirmed={basketChannelUnconfirmed}
      canSubmit={round.canSubmit && (hasPendingRound || reviewedBasketReady)}
      formatPrice={formatPrice}
      onSubmit={round.submit}
    />
  );
}
