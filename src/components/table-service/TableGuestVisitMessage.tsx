'use client';

import { useTranslation } from 'react-i18next';
import Link from '@/components/TenantLink';
import TableGuestSafeDeparture from './TableGuestSafeDeparture';
import styles from './TableGuestAccount.module.css';

export default function TableGuestVisitMessage({
  title,
  detail,
  confirmedDeparture,
  onConfirmDeparture,
  onLeave,
  onRetry,
  pending = false,
}: Readonly<{
  title: string;
  detail: string;
  confirmedDeparture?: boolean;
  onConfirmDeparture?: (confirmed: boolean) => void;
  onLeave?: () => void;
  onRetry?: () => void;
  pending?: boolean;
}>) {
  const { t } = useTranslation();
  return (
    <main className={styles.workspace}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.muted}>{detail}</p>
      {onRetry && (
        <button type="button" className={styles.button} onClick={onRetry}>
          {t('table_guest_unavailable_retry_action', t('retry', 'Retry'))}
        </button>
      )}
      {onLeave && onConfirmDeparture && (
        <TableGuestSafeDeparture
          confirmed={confirmedDeparture === true}
          onConfirmedChange={onConfirmDeparture}
          onLeave={onLeave}
          pending={pending}
        />
      )}
      {!onLeave && !pending && (
        <Link href="/menu" className={styles.button}>
          {t('table_guest_back_to_menu')}
        </Link>
      )}
    </main>
  );
}
