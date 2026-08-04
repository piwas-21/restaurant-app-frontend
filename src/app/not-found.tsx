'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import styles from './styles/ErrorSurface.module.css';

/**
 * The 404 (BUGS-IMPROVEMENTS-PLAN D2).
 *
 * Replaces Next's unstyled default, which a signed-in owner could reach from the first-run
 * checklist itself: two guards used to redirect to `/login`, a route that has never
 * existed (D1 fixes those, this makes the landing survivable if a third ever appears).
 *
 * A client component so the copy comes from `t()` in all ten locales like every other
 * user-facing string — a hardcoded English 404 on a tenant running in `nl` or `tr` reads as
 * a different site. It renders inside the root layout, so the tenant's chrome is intact and
 * the nav is right there.
 */
export default function NotFound() {
  const { t } = useTranslation();

  return (
    // <section>, not <main>: the template Shell already supplies the <main> landmark.
    <section className={styles.container}>
      <Compass className={styles.icon} size={48} aria-hidden="true" />
      <h1 className={styles.title}>{t('not_found_title', 'Page not found')}</h1>
      <p className={styles.message}>{t('not_found_message', 'This page does not exist, or it has moved.')}</p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primaryAction}>
          {t('not_found_home', 'Back to home')}
        </Link>
        <Link href="/menu" className={styles.secondaryAction}>
          {t('not_found_menu', 'View the menu')}
        </Link>
      </div>
    </section>
  );
}
