'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const { tableGuestVisitsV1, tableGuestFeatureStatus, retryTableGuestFeature } = useTableGuestFeature();
  const { phase } = useTableGuestVisit();
  const { setTableContext } = useTableContext();
  const requiresAdmission = tableGuestVisitsV1 && tableGuestFeatureStatus === 'ready' && phase === 'notJoined';

  useEffect(() => {
    if (!requiresAdmission) return;
    setTableContext({
      tableId: qr.table.tableId,
      tableNumber: qr.table.tableNumber,
      qrScanned: true,
      isOutdoor: qr.table.isOutdoor,
    });
  }, [qr, requiresAdmission, setTableContext]);

  if (!requiresAdmission) return <ScanFeatureUnavailable onRetry={retryTableGuestFeature} />;

  return (
    <main className={styles.page}>
      <TableGuestAdmissionForm
        qrCodeData={qr.code}
        tableLabel={qr.table.tableNumber}
        onJoined={() => router.push(`/${window.location.pathname.split('/').filter(Boolean)[0]}/menu`)}
      />
    </main>
  );
}
