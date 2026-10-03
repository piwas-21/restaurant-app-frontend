'use client';

import { useTranslation } from 'react-i18next';
import TenantLink from '@/components/TenantLink';
import type { TableGuestVisitPhase } from '@/types/tableGuestVisit';
import styles from './TableGuestRoundReview.module.css';

export default function TableGuestVisitBlocked({ phase }: Readonly<{ phase: TableGuestVisitPhase }>) {
  const { t } = useTranslation();
  const storageUnavailable = phase === 'storageUnavailable';
  const visitUnavailable = phase === 'unavailable';
  let titleKey = 'table_guest_ended_title';
  let detailKey = 'table_guest_ended_detail';
  if (storageUnavailable) {
    titleKey = 'table_guest_unavailable_title';
    detailKey = 'table_guest_storage_help';
  } else if (visitUnavailable) {
    titleKey = 'table_guest_unavailable_title';
    detailKey = 'table_guest_unavailable_detail';
  }
  return (
    <main className={styles.page} aria-labelledby="table-visit-ended-heading">
      <header className={styles.header}>
        <h1 id="table-visit-ended-heading">{t(titleKey)}</h1>
        <p>{t(detailKey)}</p>
      </header>
      <div className={styles.actions}>
        <TenantLink href="/table-account" className={styles.secondaryButton}>
          {t('table_guest_account_link')}
        </TenantLink>
        {!visitUnavailable && (
          <TenantLink href="/menu" className={styles.secondaryButton}>
            {t('table_guest_back_to_menu')}
          </TenantLink>
        )}
      </div>
    </main>
  );
}
