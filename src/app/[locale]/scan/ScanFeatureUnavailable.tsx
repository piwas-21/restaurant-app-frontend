'use client';

import { useTranslation } from 'react-i18next';
import styles from './ScanPage.module.css';

export default function ScanFeatureUnavailable({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useTranslation();

  return (
    <main className={styles.page}>
      <section className={styles.status} aria-labelledby="table-visit-unavailable-heading">
        <h1 id="table-visit-unavailable-heading">
          {t('table_guest_unavailable_title', t('unavailable', 'Unavailable'))}
        </h1>
        <p>{t('table_guest_ask_staff', 'Ask staff to confirm table visit availability.')}</p>
        <button type="button" onClick={onRetry} className={styles.fallbackButton}>
          {t('table_guest_unavailable_retry_action', t('retry', 'Retry'))}
        </button>
      </section>
    </main>
  );
}
