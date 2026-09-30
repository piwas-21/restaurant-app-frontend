'use client';

// craft footer (ADR-006, S15 T3 slice 2) — kraft-paper band with a Caveat
// wordmark. Same data + i18n keys as the classic footer (RestaurantInfo
// API with baked fallback, copyright, address, privacy/terms links,
// cookie-preferences trigger); the home page composes its own footer and
// the chrome hides this one there (mirrors classic).
import { useEffect, useState } from 'react';
import Link from '@/components/TenantLink';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import FooterCookieLink from '@/components/FooterCookieLink';
import PartnerCredit from '@/components/PartnerCredit';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { RESTAURANT_NAME } from '@/lib/config';
import { firstPaintCopy, type CopyFn } from '@/lib/firstPaintCopy';
import styles from './CraftFooter.module.css';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';

export default function CraftFooter() {
  const [isClient, setIsClient] = useState(false);
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const localizedHref = (href: string) => tenantLocaleHref(pathname, href);
  const { info: restaurantInfo } = useRestaurantInfo();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const restaurantName = restaurantInfo?.name ?? RESTAURANT_NAME;
  const copy: CopyFn = isClient ? (key, vars) => t(key, vars) : firstPaintCopy(i18n, i18n.language);

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <p className={styles.footerWordmark}>{restaurantName}</p>
        <p className={styles.footerText}>
          {copy('home_footer_copyright', { year: new Date().getFullYear(), name: restaurantName })}
        </p>
        {restaurantInfo && (
          <p className={styles.footerAddress}>
            {restaurantInfo.addressLine1}, {restaurantInfo.postalCode} {restaurantInfo.city}, {restaurantInfo.country}
          </p>
        )}
        <div className={styles.footerLinks}>
          <Link href={localizedHref('/privacy-policy')} className={styles.footerLink}>
            {copy('footer_privacy_policy')}
          </Link>
          <Link href={localizedHref('/terms-of-usage')} className={styles.footerLink}>
            {copy('footer_terms_of_usage')}
          </Link>
        </div>
        <FooterCookieLink />
        <PartnerCredit />
      </div>
    </footer>
  );
}
