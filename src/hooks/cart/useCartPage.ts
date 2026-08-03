'use client';

import { useState } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';
import { useCheckoutBlockerHint } from '@/hooks/checkout/useCheckoutBlockerHint';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';

/**
 * State + handlers for the cart page: item quantity/remove, special-instructions editing, promo
 * codes, and checkout routing. The page renders from this hook's return value (CLAUDE.md §5.1).
 * Extracted from app/cart/page.tsx (Sprint 4/6 god-file decomposition); behaviour unchanged.
 */
export function useCartPage() {
  const { state, removeItem, updateItem, applyPromoCode, removePromoCode, getTotal, getItemCount } = useCart();
  const { state: orderTypeState, hasChosenOrderType } = useOrderType();
  const { proceedToCheckout, isResolving } = useSmartCheckoutRouter();
  // Hosted here (and rendered by CartPageLayout) so a blocked checkout is fixed
  // on this page. It used to push('/menu') with no explanation — the customer
  // landed back on the menu having no idea what went wrong.
  const orderTypeFollowUp = useOrderTypeFollowUp();
  const hint = useCheckoutBlockerHint(hasChosenOrderType, state.items.length > 0);

  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState<string | null>(null);
  const [instructionsValue, setInstructionsValue] = useState('');

  // Check if customer has active discount (for display formatting only)
  const customerHasDiscount = (state.basket?.customerDiscount || 0) > 0 || (state.basket?.discount || 0) > 0;

  const runCheckout = async () => {
    const orderType = orderTypeState.orderType;
    if (!orderType) {
      // No type yet, and this page has no toggle — the order-type editor is the
      // one thing that can unblock it, so open it right here.
      hint.setBlocker('order-type');
      orderTypeFollowUp.editOrderType();
      return;
    }
    // Analytics-source 'cart_page' marks the legacy /cart entry — the new
    // C1.5 flow uses 'sidebar' / 'mobile_sheet'. Lets the funnel report on
    // how many users still land here vs. the redesigned surfaces.
    const blocker = await proceedToCheckout(orderType, 'cart_page');
    hint.setBlocker(blocker);
    if (blocker === 'details') {
      orderTypeFollowUp.pickType(orderType, 'cart_page', true);
    }
  };

  // proceedToCheckout has its own try/catch; fire-and-forget so the DOM handler
  // stays synchronous.
  const handleCheckout = () => void runCheckout();

  /**
   * IGNORED ON PURPOSE — and verified end to end rather than asserted, because "handled
   * elsewhere" is the claim a swallowed failure always makes.
   *
   * `useCartItemMutations` catches, resolves the sentence with `getErrorMessage(error) ??
   * unexpectedError`, dispatches `SET_ERROR`, rolls the optimistic update back, logs, and then
   * RETHROWS for the caller. `CartPageLayout` renders `state.error`, and both templates supply the
   * `.errorContainer`/`.errorMessage` classes it needs (`app/styles/CartPage.module.css` for
   * classic, `templates/craft/cart/CartPage.module.css` for craft) — so the message is on screen
   * in both skins, not just the one the developer happened to run.
   *
   * These catches exist only to stop that deliberate rethrow becoming an unhandled rejection.
   * Binding the error here would lower the ratchet and show the user nothing new.
   */
  const handleRemoveItem = async (basketItemId: string | undefined) => {
    if (!basketItemId) return;
    try {
      await removeItem(basketItemId);
    } catch {
      // Surfaced by CartContext — see the note above.
    }
  };

  const handleUpdateQuantity = async (basketItemId: string | undefined, newQuantity: number) => {
    if (!basketItemId || newQuantity < 1) return;
    try {
      await updateItem(basketItemId, newQuantity);
    } catch {
      // Surfaced by CartContext — see the note on `handleRemoveItem`.
    }
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setIsApplyingPromo(true);
    try {
      await applyPromoCode(promoCode.trim());
      setPromoCode('');
    } catch {
      // Surfaced by CartContext — see the note on `handleRemoveItem`. Caught rather than left to
      // `finally` alone: `applyPromoCode` rethrows, and this is called straight from an onClick, so
      // without a catch the rejection went nowhere a handler could see it. The user still saw the
      // message (it is in `state.error` by then), but the console carried an unhandled rejection on
      // every refused promo code.
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromoCode = async () => {
    try {
      await removePromoCode();
    } catch {
      // Surfaced by CartContext — see the note on `handleRemoveItem`.
    }
  };

  const handleSaveInstructions = async (basketItemId: string | undefined, quantity: number, instructions: string) => {
    if (!basketItemId) return;
    try {
      await updateItem(basketItemId, quantity, instructions);
      setEditingInstructions(null);
      setInstructionsValue('');
    } catch {
      // Surfaced by CartContext — see the note on `handleRemoveItem`.
    }
  };

  return {
    state,
    getTotal,
    getItemCount,
    isResolving,
    customerHasDiscount,
    /** Follow-up modal cluster — rendered by CartPageLayout. */
    orderTypeFollowUp,
    /** Translated reason the CTA won't route yet ('' when nothing blocks it). */
    blockerMessage: hint.message,
    promoCode,
    setPromoCode,
    isApplyingPromo,
    editingInstructions,
    setEditingInstructions,
    instructionsValue,
    setInstructionsValue,
    handleCheckout,
    handleRemoveItem,
    handleUpdateQuantity,
    handleApplyPromoCode,
    handleRemovePromoCode,
    handleSaveInstructions,
  };
}
