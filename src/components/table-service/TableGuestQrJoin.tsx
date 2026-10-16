'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import TenantLink from '@/components/TenantLink';
import { reportTableGuestFailure } from '@/lib/tableGuestFailureDiagnostics';
import styles from './TableGuestQrJoin.module.css';

interface TableGuestQrJoinProps {
  readonly qrCodeData: string;
  readonly tableId: string;
  readonly tableLabel: string;
}

export default function TableGuestQrJoin({ qrCodeData, tableId, tableLabel }: TableGuestQrJoinProps) {
  const { t } = useTranslation();
  const { joinVisit, phase, featureEnabled } = useTableGuestVisit();
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const attempted = useRef(false);
  const handleJoin = async () => {
    setIsJoining(true);
    setError('');
    try {
      await joinVisit(qrCodeData, tableId);
    } catch (joinError) {
      reportTableGuestFailure('join visit', joinError);
      setError(t('table_guest_qr_join_failed'));
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (attempted.current || !featureEnabled || phase !== 'notJoined') return;
    attempted.current = true;
    void handleJoin();
  });

  if (phase === 'loading') {
    return (
      <p className={styles.message}>
        <output>{t('loading')}</output>
      </p>
    );
  }
  if (!featureEnabled || phase !== 'notJoined') {
    let message = t('table_guest_qr_ended_detail');
    if (phase === 'active') message = t('table_guest_already_joined');
    else if (phase === 'storageUnavailable') message = t('table_guest_storage_help');
    return (
      <section className={styles.panel} aria-labelledby="table-guest-join-heading">
        <h1 id="table-guest-join-heading" className={styles.title}>
          {t('table_guest_join_title')}
        </h1>
        <p className={styles.description}>{message}</p>
        <TenantLink href="/table-account" className={styles.accountLink}>
          {t('table_guest_account_link')}
        </TenantLink>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="table-guest-join-heading">
      <h1 id="table-guest-join-heading" className={styles.title}>
        {t('table_guest_join_title')}
      </h1>
      <p className={styles.description}>{t('table_guest_qr_join_description', { table: tableLabel })}</p>
      <div className={styles.form}>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              type="button"
              className={styles.submitButton}
              disabled={isJoining}
              onClick={() => void handleJoin()}
            >
              {t('retry')}
            </button>
          </>
        ) : (
          <output>{t('table_guest_joining')}</output>
        )}
      </div>
    </section>
  );
}
