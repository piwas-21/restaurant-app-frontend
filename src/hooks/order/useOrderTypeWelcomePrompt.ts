'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { OrderType } from '@/types/order';

interface PromptState {
  showWelcomeModal: boolean;
  /**
   * Manually open the modal (sticky header's "change" affordance, etc.).
   * Always opens — does NOT consult the hasPromptedRef one-shot guard,
   * which only governs the automatic first-visit open.
   */
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
}

/**
 * Owns the /menu welcome-modal trigger logic:
 *
 *   1. QR-scan landings (table context present) → auto-pin DineIn + the
 *      scanned table number. No prompt — we already know the answer.
 *   2. First-time non-QR visitor with no prior choice → open the modal
 *      once the page has hydrated.
 *   3. Returning visitor → no prompt; the prior selection is in
 *      localStorage (OrderTypeContext loads it on mount).
 *
 * The modal opens **at most once per page lifetime**. Without that guard,
 * any later flow that calls `clearOrderType()` (e.g. a future
 * sticky-header "change → cancel" path) would silently re-open the
 * welcome modal even after the user explicitly dismissed it.
 *
 * The `isMounted` gate prevents an SSR/hydration mismatch — the
 * underlying state from OrderTypeContext is loaded inside an effect, so
 * `hasChosenOrderType` is always false at first render.
 */
export function useOrderTypeWelcomePrompt(): PromptState {
  const { hasChosenOrderType, setOrderType, setTable } = useOrderType();
  const { hasTableContext, tableContext } = useTableContext();
  const [isMounted, setIsMounted] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const hasPromptedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (hasTableContext && tableContext.tableNumber && !hasChosenOrderType) {
      setOrderType(OrderType.DineIn);
      setTable(tableContext.tableNumber);
    }
  }, [hasTableContext, tableContext.tableNumber, hasChosenOrderType, setOrderType, setTable]);

  useEffect(() => {
    if (!isMounted) return;
    if (hasPromptedRef.current) return;
    if (hasChosenOrderType || hasTableContext) return;
    hasPromptedRef.current = true;
    setShowWelcomeModal(true);
  }, [isMounted, hasChosenOrderType, hasTableContext]);

  const openWelcomeModal = useCallback(() => setShowWelcomeModal(true), []);
  const closeWelcomeModal = useCallback(() => setShowWelcomeModal(false), []);

  return { showWelcomeModal, openWelcomeModal, closeWelcomeModal };
}
