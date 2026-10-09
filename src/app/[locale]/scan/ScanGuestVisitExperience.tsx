'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTableContext } from '@/contexts/TableContext';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import TableGuestAdmissionForm from '@/components/table-service/TableGuestAdmissionForm';
import ScanFeatureUnavailable from './ScanFeatureUnavailable';
import styles from './ScanPage.module.css';

export interface ScanGuestVisitQr {
  readonly code: string;
  readonly table: {
    readonly tableId: string;
    readonly tableNumber: string;
    readonly isOutdoor: boolean;
  };
}

export default function ScanGuestVisitExperience({ qr }: Readonly<{ qr: ScanGuestVisitQr }>) {
  const router = useRouter();
  const { t } = useTranslation();
  const { tableGuestVisitsV1, tableGuestFeatureStatus, retryTableGuestFeature } = useTableGuestFeature();
  const { phase, visit, pendingRound, pendingRoundStatus, getAccount } = useTableGuestVisit();
  const { tableContext, setTableContext } = useTableContext();
  const requiresAdmission = tableGuestVisitsV1 && tableGuestFeatureStatus === 'ready' && phase === 'notJoined';
  const canResumeCandidate =
    tableGuestVisitsV1 &&
    tableGuestFeatureStatus === 'ready' &&
    phase === 'active' &&
    visit?.tableId?.toLowerCase() === qr.table.tableId.toLowerCase() &&
    pendingRound === null &&
    pendingRoundStatus === 'known';
  const resumeKey = canResumeCandidate && visit ? `${visit.serviceSessionId}:${visit.tableId}` : null;
  const [checkedResumeKey, setCheckedResumeKey] = useState<string | null>(null);
  const [verifiedResumeKey, setVerifiedResumeKey] = useState<string | null>(null);

  useEffect(() => {
    if (!requiresAdmission) return;
    setTableContext({
      tableId: qr.table.tableId,
      tableNumber: qr.table.tableNumber,
      qrScanned: true,
      isOutdoor: qr.table.isOutdoor,
    });
  }, [qr, requiresAdmission, setTableContext]);

  useEffect(() => {
    if (!resumeKey || !visit) return;
    let isCurrent = true;
    setCheckedResumeKey(null);
    setVerifiedResumeKey(null);

    void getAccount()
      .then((account) => {
        if (!isCurrent) return;
        const sameSession = account.serviceSessionId.toLowerCase() === visit.serviceSessionId.toLowerCase();
        const sameTable = account.tableLabel?.trim() === qr.table.tableNumber.trim();
        if (!sameSession || !sameTable) return;

        setTableContext({
          tableId: qr.table.tableId,
          tableNumber: qr.table.tableNumber,
          qrScanned: true,
          isOutdoor: qr.table.isOutdoor,
        });
        setVerifiedResumeKey(resumeKey);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isCurrent) setCheckedResumeKey(resumeKey);
      });

    return () => {
      isCurrent = false;
    };
  }, [getAccount, qr.table, resumeKey, setTableContext, visit]);

  useEffect(() => {
    if (
      !resumeKey ||
      verifiedResumeKey !== resumeKey ||
      tableContext.tableId?.toLowerCase() !== qr.table.tableId.toLowerCase()
    ) {
      return;
    }
    const locale = window.location.pathname.split('/').find((segment) => segment.length > 0);
    router.replace(locale ? `/${locale}/menu` : '/menu');
  }, [qr.table.tableId, resumeKey, router, tableContext.tableId, verifiedResumeKey]);

  if (resumeKey && (checkedResumeKey !== resumeKey || verifiedResumeKey === resumeKey)) {
    return (
      <main className={styles.page}>
        <section className={styles.status} aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <p>{t('loading')}</p>
        </section>
      </main>
    );
  }

  if (!requiresAdmission) return <ScanFeatureUnavailable onRetry={retryTableGuestFeature} />;

  return (
    <main className={styles.page}>
      <TableGuestAdmissionForm qrCodeData={qr.code} tableId={qr.table.tableId} tableLabel={qr.table.tableNumber} />
    </main>
  );
}
