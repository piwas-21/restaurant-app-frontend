'use client';

// craft footer (ADR-006, S15 T3 slice 2) — kraft-paper band with a Caveat
// wordmark. Same data + i18n keys as the classic footer (RestaurantInfo
// API with baked fallback, copyright, address, privacy/terms links,
// cookie-preferences trigger); the home page composes its own footer and
// the chrome hides this one there (mirrors classic).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import FooterCookieLink from '@/components/FooterCookieLink';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { RESTAURANT_NAME } from '@/lib/config';
import styles from './CraftFooter.module.css';

export default function CraftFooter() {
  const [isClient, setIsClient] = useState(false);
  const { t } = useTranslation();
  const { info: restaurantInfo } = useRestaurantInfo();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const restaurantName = restaurantInfo?.name ?? RESTAURANT_NAME;

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <p className={styles.footerWordmark}>{restaurantName}</p>
        <p className={styles.footerText}>
          {isClient
            ? t('home_footer_copyright', { year: new Date().getFullYear(), name: restaurantName })
            : `© ${new Date().getFullYear()} ${RESTAURANT_NAME}. All rights reserved.`}
        </p>
        {restaurantInfo && (
          <p className={styles.footerAddress}>
            {restaurantInfo.addressLine1}, {restaurantInfo.postalCode} {restaurantInfo.city}, {restaurantInfo.country}
          </p>
        )}
        <div className={styles.footerLinks}>
          <Link href="/privacy-policy" className={styles.footerLink}>
            {isClient ? t('footer_privacy_policy', 'Privacy Policy') : 'Privacy Policy'}
          </Link>
          <Link href="/terms-of-usage" className={styles.footerLink}>
            {isClient ? t('footer_terms_of_usage', 'Terms of Usage') : 'Terms of Usage'}
          </Link>
        </div>
        <FooterCookieLink />
      </div>
    </footer>
  );
}
