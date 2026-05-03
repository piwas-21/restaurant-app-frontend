'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { Loader2 } from 'lucide-react';
import styles from '../../styles/OrderTypePage.module.css';

/**
 * Legacy redirect (BUGS-IMPROVEMENTS-PLAN §C1.5.c). The standalone
 * order-type page has been replaced by the cart-sidebar order-type
 * toggle on /menu (with table + delivery-address modals as follow-ups).
 * We keep this file as a redirect for one release for back-compat with
 * bookmarks, the cart-page checkout button (which still pushes here
 * when there's no QR table context), and any external links.
 *
 * Pragmatic deviation from earlier plan drafts: when an order type has
 * been chosen, redirect to `/checkout/customer-info` (the next checkout
 * step) rather than `/cart`. A `/cart` target would loop with the
 * cart-page's checkout button on the no-QR path until C1.5.d makes
 * /cart smart enough to skip /checkout/order-type altogether.
 */
export default function OrderTypePageRedirect() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasChosenOrderType } = useOrderType();

  useEffect(() => {
    router.replace(hasChosenOrderType ? '/checkout/customer-info' : '/menu');
  }, [hasChosenOrderType, router]);

  return (
    <main className={styles.container} aria-busy="true">
      <div className={styles.emptyState}>
        <Loader2 size={28} aria-hidden="true" />
        <p>{t('redirecting', 'Redirecting…')}</p>
      </div>
    </main>
  );
}
