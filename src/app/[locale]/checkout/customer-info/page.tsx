'use client';

import { useEffect } from 'react';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCart } from '@/components/cart/CartContext';
import styles from '@/app/styles/OrderTypePage.module.css';
import { useTenantPublicNavigation } from '@/hooks/useTenantPublicNavigation';

/**
 * Legacy redirect (BUGS-IMPROVEMENTS-PLAN §C1.5.h). The standalone
 * customer-info page has been replaced by inline contact-info inputs
 * inside the order-type modals on /menu (TableSelectionModal,
 * DeliveryAddressModal, TakeawayInfoModal — see §C1.5.e + §C1.5.g).
 *
 * Kept as a redirect for one release for back-compat with bookmarks
 * and the legacy /checkout/order-type redirect chain. After that,
 * deletion.
 *
 * Routes:
 *   - cart empty                                       → /menu
 *   - no order type chosen                             → /menu (sidebar toggle is the entry point)
 *   - cart + order type + customerInfo already in ctx  → /checkout/review (smart-skip)
 *   - cart + order type, missing customerInfo          → /menu (the modal will collect it)
 */
export default function CustomerInfoPageRedirect() {
  const { t } = useTranslation();
  const { replace } = useTenantLocaleRouter();
  const { replaceMenu } = useTenantPublicNavigation();
  const { state: checkoutState } = useCheckout();
  const { state: cartState } = useCart();

  useEffect(() => {
    if (cartState.items.length === 0) {
      replaceMenu();
      return;
    }
    if (!checkoutState.orderType) {
      replaceMenu();
      return;
    }
    if (checkoutState.customerInfo) {
      replace('/checkout/review');
      return;
    }
    replaceMenu();
  }, [cartState.items.length, checkoutState.orderType, checkoutState.customerInfo, replace, replaceMenu]);

  return (
    <main className={styles.container} aria-busy="true">
      <div className={styles.emptyState}>
        <Loader2 size={28} aria-hidden="true" />
        <p>{t('redirecting', 'Redirecting…')}</p>
      </div>
    </main>
  );
}
