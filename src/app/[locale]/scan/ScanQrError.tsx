'use client';

import { useTranslation } from 'react-i18next';
import styles from './ScanPage.module.css';

export default function ScanQrError({
  error,
  canUseLegacyMenu,
  onGoToMenu,
}: Readonly<{ error: string; canUseLegacyMenu: boolean; onGoToMenu: () => void }>) {
  const { t } = useTranslation();

  return (
    <main className={styles.page}>
      <section className={styles.status} aria-labelledby="qr-code-error-heading">
        <h1 id="qr-code-error-heading" className={styles.errorTitle}>
          {t('qr_code_error')}
        </h1>
        <p>{error}</p>
        {canUseLegacyMenu ? (
          <button type="button" onClick={onGoToMenu} className={styles.fallbackButton}>
            {t('go_to_menu')}
          </button>
        ) : (
          <p>{t('table_guest_ask_staff', 'Ask staff to confirm the table QR code and current visit code.')}</p>
        )}
      </section>
    </main>
  );
}
