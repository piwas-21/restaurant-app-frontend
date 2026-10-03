'use client';

// The /checkout/review "can this page exist?" guard, split out of
// useCheckoutReview (§4 LOC limit) because it grew a hydration gate.
import { useEffect } from 'react';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCart } from '@/components/cart/CartContext';
import { useTenantPublicNavigation } from '@/hooks/useTenantPublicNavigation';

export interface CheckoutPrereqGuard {
  /**
   * True once BOTH stores have actually loaded, so their emptiness means
   * something. Callers also use it to keep the page in its loading state until
   * then, rather than flashing a prereqs-missing render.
   */
  storesReady: boolean;
  /** Cart empty, or no order type / customer info once the stores are ready. */
  isMissingPrereqs: boolean;
}

export interface TableGuestVisitPrerequisites {
  readonly active: boolean;
  readonly loading: boolean;
  readonly blocked: boolean;
  readonly hasPendingRound: boolean;
}

/**
 * Redirects away from the review page when its prerequisites aren't met — but
 * only once both stores have loaded.
 *
 * That gate is the whole point. CartContext starts at `items: []` and syncs the
 * basket in an effect; CheckoutContext starts empty and hydrates from
 * localStorage in an effect. Judging the prereqs during that window meant a
 * perfectly valid checkout got bounced to /cart (or /menu) on arrival, which is
 * the intermittent "it went to the cart, then worked on the second try" report.
 * `lastSyncedAt` is the cart's own has-loaded signal; `isHydrated` is
 * CheckoutContext's.
 *
 * `skip` suppresses the guard entirely — the review page passes a just-confirmed
 * order, whose success modal must not be redirected out from under the customer
 * (placing the order clears both the cart and the checkout state).
 */
export function useCheckoutPrereqGuard(skip: boolean, tableVisit?: TableGuestVisitPrerequisites): CheckoutPrereqGuard {
  const { push } = useTenantLocaleRouter();
  const { pushMenu } = useTenantPublicNavigation();
  const { state: checkoutState, isHydrated } = useCheckout();
  const { state: cartState } = useCart();

  const storesReady = cartState.lastSyncedAt !== null && isHydrated;
  const hasItems = cartState.items.length > 0;
  const hasCheckoutData = !!checkoutState.orderType && (tableVisit?.active === true || !!checkoutState.customerInfo);
  // A pending operation is recovery evidence even when its visit/feature read is unavailable.
  // Do not let ordinary checkout prerequisites redirect away before its exact operation can be
  // looked up. The guest runtime's loading state still holds the page while this evidence is
  // being hydrated.
  const holdForTableVisit =
    tableVisit?.loading === true || tableVisit?.blocked === true || tableVisit?.hasPendingRound === true;

  useEffect(() => {
    if (skip || holdForTableVisit || !storesReady) return;
    if (!hasItems) {
      push('/cart');
    } else if (!hasCheckoutData) {
      pushMenu();
    }
  }, [skip, holdForTableVisit, storesReady, hasItems, hasCheckoutData, push, pushMenu]);

  return {
    storesReady,
    isMissingPrereqs: !holdForTableVisit && (!storesReady || !hasItems || !hasCheckoutData),
  };
}
