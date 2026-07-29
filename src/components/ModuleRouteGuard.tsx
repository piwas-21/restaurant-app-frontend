'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { PackageX } from 'lucide-react';
import { moduleForPath } from '@/lib/modules';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import styles from './ModuleRouteGuard.module.css';

/**
 * Hides a route belonging to a module this tenant did not buy (sofra ADR-010 / S11,
 * SOFRA-ONBOARDING-PLAN O5).
 *
 * Wraps the page content ONCE in the root layout, inside the template Shell, rather than
 * being added to each gated page. Two reasons: the chrome stays (a blocked route is a
 * normal page of this app, not a broken one), and a new sub-route under a gated prefix is
 * covered without anyone remembering to add a guard to it.
 *
 * FAILS OPEN by construction: a path no module owns renders its children, and the modules
 * context defaults to the full set. This wraps every page in the app, so the failure mode
 * of a bug here has to be "shows too much", never "shows nothing".
 *
 * This is presentation only — the API is gated independently by the backend's
 * [RequireModule]. Removing this component would make the surfaces visible again, not
 * usable.
 */
export default function ModuleRouteGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const enabled = useModuleEnabled(moduleForPath(pathname ?? ''));

  if (enabled) return <>{children}</>;

  return (
    <main className={styles.container}>
      <PackageX className={styles.icon} size={48} aria-hidden="true" />
      <h1 className={styles.title}>{t('module_unavailable_title', 'Not available here')}</h1>
      <p className={styles.message}>
        {t('module_unavailable_message', 'This restaurant does not offer this feature.')}
      </p>
      <Link href="/" className={styles.action}>
        {t('module_unavailable_action', 'Back to home')}
      </Link>
    </main>
  );
}
