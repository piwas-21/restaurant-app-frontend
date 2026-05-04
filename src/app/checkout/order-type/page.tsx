'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
 * Always redirects to `/menu` now (§C1.5.h). The chosen order type is
 * preserved in OrderTypeContext, and the sidebar's Proceed-to-Checkout
 * runs the smart-skip router from there. Earlier drafts routed to
 * /checkout/customer-info when a type was already chosen, but that page
 * is also a redirect now.
 */
export default function OrderTypePageRedirect() {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    router.replace('/menu');
  }, [router]);

  return (
    <main className={styles.container} aria-busy="true">
      <div className={styles.emptyState}>
        <Loader2 size={28} aria-hidden="true" />
        <p>{t('redirecting', 'Redirecting…')}</p>
      </div>
    </main>
  );
}
