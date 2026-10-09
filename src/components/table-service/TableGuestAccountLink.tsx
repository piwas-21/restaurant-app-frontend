'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReceiptText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import { tenantLocaleFromPathname } from '@/lib/tenantLocaleRouting';
import styles from './TableGuestAccountLink.module.css';

export default function TableGuestAccountLink() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { featureEnabled, phase, requiresSafeDeparture } = useTableGuestVisit();
  const canShow = featureEnabled || phase === 'active' || requiresSafeDeparture || phase === 'storageUnavailable';
  if (!canShow) return null;

  const locale = tenantLocaleFromPathname(pathname);
  const href = locale ? `/${locale}/table-account` : '/table-account';
  return (
    <Link className={styles.link} href={href}>
      <ReceiptText aria-hidden="true" size={18} />
      <span>{t('table_guest_account_link')}</span>
    </Link>
  );
}
