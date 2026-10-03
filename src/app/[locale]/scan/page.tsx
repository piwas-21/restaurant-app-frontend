'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTableContext } from '@/contexts/TableContext';
import { useTenantPublicNavigation } from '@/hooks/useTenantPublicNavigation';
import type { ScanGuestVisitQr } from './ScanGuestVisitExperience';
import styles from './ScanPage.module.css';

const LazyTableGuestRouteRuntimeLoader = dynamic(() => import('@/contexts/TableGuestRouteRuntimeLoader'), {
  ssr: false,
  loading: ScanLoadingStatus,
});
const LazyScanGuestVisitExperience = dynamic(() => import('./ScanGuestVisitExperience'), {
  ssr: false,
  loading: ScanLoadingStatus,
});
const LazyScanFeatureUnavailable = dynamic(() => import('./ScanFeatureUnavailable'), {
  ssr: false,
  loading: ScanLoadingStatus,
});
const LazyScanQrError = dynamic(() => import('./ScanQrError'), {
  ssr: false,
  loading: ScanLoadingStatus,
});
const LazyScanTableGuestFeatureReader = dynamic(() => import('./ScanTableGuestFeatureReader'), {
  ssr: false,
  loading: ScanLoadingStatus,
});

function ScanLoadingStatus() {
  const { t } = useTranslation();
  return <ScanStatus title={t('loading')} detail="" />;
}

interface TableValidation {
  isValid: boolean;
  tableId: string;
  tableNumber: string;
  maxGuests: number;
  isOutdoor: boolean;
  qrCodeGeneratedAt?: string;
}

function ScanPageContent() {
  return (
    <LazyScanTableGuestFeatureReader>
      {(feature) => (
        <ScanPageExperience
          tableGuestVisitsV1={feature.tableGuestVisitsV1}
          tableGuestFeatureStatus={feature.tableGuestFeatureStatus}
          hasStoredGuestState={feature.hasStoredGuestState}
          retryTableGuestFeature={feature.retryTableGuestFeature}
        />
      )}
    </LazyScanTableGuestFeatureReader>
  );
}

function ScanPageExperience({
  tableGuestVisitsV1,
  tableGuestFeatureStatus,
  hasStoredGuestState,
  retryTableGuestFeature,
}: {
  readonly tableGuestVisitsV1: boolean;
  readonly tableGuestFeatureStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  readonly hasStoredGuestState: boolean;
  readonly retryTableGuestFeature: () => void;
}) {
  const { t } = useTranslation();
  const { pushMenu } = useTenantPublicNavigation();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get('qr');
  const { setTableContext } = useTableContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatedVisitQr, setValidatedVisitQr] = useState<ScanGuestVisitQr | null>(null);
  const requiresVisitAwareExperience =
    tableGuestFeatureStatus === 'ready' && (tableGuestVisitsV1 || hasStoredGuestState);
  const canUseLegacyMenu = !tableGuestVisitsV1 && tableGuestFeatureStatus === 'ready' && !hasStoredGuestState;

  useEffect(() => {
    setValidatedVisitQr(null);
    if (tableGuestFeatureStatus === 'idle' || tableGuestFeatureStatus === 'loading') {
      setLoading(true);
      return;
    }
    if (!qrCode) {
      setError(t('qr_code_missing'));
      setLoading(false);
      return;
    }

    let current = true;
    let redirectTimer: number | undefined;
    setLoading(true);
    setError(null);
    void validateQr(qrCode)
      .then((tableData) => {
        if (!current) return;
        if (!tableData) {
          setError(t('qr_code_invalid'));
          setLoading(false);
          return;
        }
        if (requiresVisitAwareExperience) {
          setValidatedVisitQr({ code: qrCode, table: tableData });
          setLoading(false);
          return;
        }
        if (!canUseLegacyMenu) {
          setLoading(false);
          return;
        }
        setTableContext({
          tableId: tableData.tableId,
          tableNumber: tableData.tableNumber,
          qrScanned: true,
          isOutdoor: tableData.isOutdoor,
        });
        setLoading(false);
        redirectTimer = window.setTimeout(() => pushMenu(), 1000);
      })
      .catch(() => {
        if (current) {
          setError(t('qr_code_validation_error'));
          setLoading(false);
        }
      });
    return () => {
      current = false;
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [
    canUseLegacyMenu,
    hasStoredGuestState,
    pushMenu,
    qrCode,
    requiresVisitAwareExperience,
    setTableContext,
    tableGuestFeatureStatus,
    t,
  ]);

  if (loading) return <ScanStatus title={t('validating_qr_code')} detail={t('please_wait')} />;

  if (tableGuestFeatureStatus === 'idle' || tableGuestFeatureStatus === 'loading') {
    return <ScanStatus title={t('loading')} detail="" />;
  }

  if (tableGuestFeatureStatus === 'unavailable') {
    return <LazyScanFeatureUnavailable onRetry={retryTableGuestFeature} />;
  }

  if (validatedVisitQr?.code === qrCode && requiresVisitAwareExperience) {
    return <LazyScanGuestVisitExperience qr={validatedVisitQr} />;
  }

  if (error) return <LazyScanQrError error={error} canUseLegacyMenu={canUseLegacyMenu} onGoToMenu={pushMenu} />;

  if (!canUseLegacyMenu) return <LazyScanFeatureUnavailable onRetry={retryTableGuestFeature} />;

  return <ScanStatus title={t('qr_code_valid')} detail={t('redirecting_to_menu')} />;
}

async function validateQr(qrCode: string): Promise<TableValidation | null> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/Tables/validate-qr/${encodeURIComponent(qrCode)}`,
  );
  const result = (await response.json()) as { success?: boolean; data?: TableValidation };
  if (!response.ok || !result.success || !result.data) return null;
  return result.data;
}

function ScanStatus({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <main className={styles.page}>
      <section className={styles.status} aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <h1>{title}</h1>
        <p>{detail}</p>
      </section>
    </main>
  );
}

export default function ScanPage() {
  return (
    <LazyTableGuestRouteRuntimeLoader readPublicTableGuestFeature>
      <Suspense fallback={<ScanLoadingStatus />}>
        <ScanPageContent />
      </Suspense>
    </LazyTableGuestRouteRuntimeLoader>
  );
}
