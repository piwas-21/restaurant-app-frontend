'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';

/**
 * State + handlers for the cart page: item quantity/remove, special-instructions editing, promo
 * codes, and checkout routing. The page renders from this hook's return value (CLAUDE.md §5.1).
 * Extracted from app/cart/page.tsx (Sprint 4/6 god-file decomposition); behaviour unchanged.
 */
export function useCartPage() {
  const router = useRouter();
  const { state, removeItem, updateItem, applyPromoCode, removePromoCode, getTotal, getItemCount } = useCart();
  const { state: orderTypeState, hasChosenOrderType } = useOrderType();
  const { proceedToCheckout, isResolving } = useSmartCheckoutRouter();

  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState<string | null>(null);
  const [instructionsValue, setInstructionsValue] = useState('');

  // Check if customer has active discount (for display formatting only)
  const customerHasDiscount = (state.basket?.customerDiscount || 0) > 0 || (state.basket?.discount || 0) > 0;

  const handleCheckout = () => {
    if (hasChosenOrderType && orderTypeState.orderType) {
      // proceedToCheckout has its own try/catch (toasts on failure); fire-and-forget.
      // Analytics-source 'cart_page' marks the legacy /cart entry — the new
      // C1.5 flow uses 'sidebar' / 'mobile_sheet'. Lets the funnel report on
      // how many users still land here vs. the redesigned surfaces.
      void proceedToCheckout(orderTypeState.orderType, 'cart_page');
      return;
    }
    router.push('/menu');
  };

  const handleRemoveItem = async (basketItemId: string | undefined) => {
    if (!basketItemId) return;
    try {
      await removeItem(basketItemId);
    } catch {
      // Error already handled by CartContext
    }
  };

  const handleUpdateQuantity = async (basketItemId: string | undefined, newQuantity: number) => {
    if (!basketItemId || newQuantity < 1) return;
    try {
      await updateItem(basketItemId, newQuantity);
    } catch {
      // Error already handled by CartContext
    }
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setIsApplyingPromo(true);
    try {
      await applyPromoCode(promoCode.trim());
      setPromoCode('');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromoCode = async () => {
    try {
      await removePromoCode();
    } catch {
      // Error already handled by CartContext
    }
  };

  const handleSaveInstructions = async (basketItemId: string | undefined, quantity: number, instructions: string) => {
    if (!basketItemId) return;
    try {
      await updateItem(basketItemId, quantity, instructions);
      setEditingInstructions(null);
      setInstructionsValue('');
    } catch {
      // Error already handled by CartContext
    }
  };

  return {
    state,
    getTotal,
    getItemCount,
    isResolving,
    customerHasDiscount,
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
