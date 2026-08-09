'use client';

import { useCallback, useMemo, useState } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

/**
 * The menu page's basket state: the totals its two entry points display, whether the slide-over is
 * open, and the add-to-cart pulse.
 *
 * One owner, because there are now THREE surfaces reading it and they must agree: the basket button
 * in the sticky category bar, the floating cart button, and the `CartSheet` both of them open. The
 * page used to hold all of this inline; extracting it is also what keeps `app/menu/page.tsx` an
 * orchestrator under the §4 200-LOC ceiling.
 *
 * `source` is carried on the open event so the funnel can still tell the two entry points apart —
 * that distinction is why the analytics call lives here rather than at each call site, where one of
 * them would eventually be added without it.
 */
export function useMenuCart() {
  const { state: cartState } = useCart();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  const itemCount = useMemo(() => cartState.items.reduce((sum, item) => sum + item.quantity, 0), [cartState.items]);
  const cartTotal = cartState.basket?.total || 0;

  const openSheet = useCallback(
    (source: 'menu_bar' | 'mobile_sheet') => {
      // Fired in the same handler that sets the open state, so it can never re-fire on hydration or
      // on a re-render — only on a genuine user action.
      trackEvent('cart_opened', { source, itemCount, loggedIn: isLoggedInForAnalytics() });
      setIsSheetOpen(true);
    },
    [itemCount],
  );

  const closeSheet = useCallback(() => setIsSheetOpen(false), []);

  /** A brief flash on the cart button when something lands in it. */
  const flash = useCallback(() => {
    setPulse(true);
    setTimeout(() => setPulse(false), 100);
  }, []);

  return { itemCount, cartTotal, isSheetOpen, openSheet, closeSheet, pulse, flash };
}
