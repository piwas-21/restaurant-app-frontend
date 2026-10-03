'use client';

import { useCart } from '@/components/cart/CartContext';
import { useTableGuestRoundSubmission } from '@/hooks/checkout/useTableGuestRoundSubmission';
import TableGuestRoundReview from './TableGuestRoundReview';

export default function TableGuestRoundReviewContainer({
  formatPrice,
  recoveryOnly = false,
}: Readonly<{ formatPrice: (amount: number) => string; recoveryOnly?: boolean }>) {
  const { state, clearCart, syncBasket } = useCart();
  const round = useTableGuestRoundSubmission({
    basket: state.basket,
    itemCount: state.items.length,
    syncBasket,
    clearCart,
  });

  return (
    <TableGuestRoundReview
      items={state.items}
      total={state.basket?.total ?? 0}
      isSubmitting={round.isSubmitting}
      error={round.error}
      pendingRound={round.pendingRound}
      pendingRoundUnavailable={round.pendingRoundUnavailable}
      acknowledgement={round.lastRoundAcknowledgement}
      recoveryOnly={recoveryOnly}
      canSubmit={round.canSubmit}
      formatPrice={formatPrice}
      onSubmit={round.submit}
    />
  );
}
