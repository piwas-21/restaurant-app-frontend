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
 * We keep this file as a redirect for back-compat with bookmarks and any
 * external links.
 *
 * ORDER-TYPE-AVAILABILITY-PLAN §5 lists deleting this stub under S5. Kept
 * deliberately: it is 39 lines, `legacy-checkout-redirects.e2e.ts` pins the
 * back-compat it provides, and removing it turns working bookmarks into 404s
 * for no benefit. The valuable half of that plan item — the stale comment in
 * OrderTypeContext that spawned a phantom bug (§3.3) — is fixed.
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
