'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCart } from '@/components/cart/CartContext';
import styles from '../../styles/OrderTypePage.module.css';

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
  const router = useRouter();
  const { state: checkoutState } = useCheckout();
  const { state: cartState } = useCart();

  useEffect(() => {
    if (cartState.items.length === 0) {
      router.replace('/menu');
      return;
    }
    if (!checkoutState.orderType) {
      router.replace('/menu');
      return;
    }
    if (checkoutState.customerInfo) {
      router.replace('/checkout/review');
      return;
    }
    router.replace('/menu');
  }, [cartState.items.length, checkoutState.orderType, checkoutState.customerInfo, router]);

  return (
    <main className={styles.container} aria-busy="true">
      <div className={styles.emptyState}>
        <Loader2 size={28} aria-hidden="true" />
        <p>{t('redirecting', 'Redirecting…')}</p>
      </div>
    </main>
  );
}
