'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicTableGuestFeatureResult } from '@/services/publicTableGuestFeatureService';
import { hasStoredTableGuestState } from '@/services/tableGuestVisitStorage';

export type TableGuestFeatureStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

interface TableGuestFeatureState {
  readonly tableGuestVisitsV1: boolean;
  readonly tableGuestFeatureStatus: TableGuestFeatureStatus;
  readonly hasStoredGuestState: boolean;
  readonly retryVersion: number;
  readonly retryTableGuestFeature: () => void;
}

const DEFAULT_FEATURE: TableGuestFeatureState = {
  tableGuestVisitsV1: false,
  tableGuestFeatureStatus: 'idle',
  hasStoredGuestState: false,
  retryVersion: 0,
  retryTableGuestFeature: () => undefined,
};
const TableGuestFeatureContext = createContext<TableGuestFeatureState>(DEFAULT_FEATURE);

export function TableGuestFeatureProvider({
  features,
  readPublicTableGuestFeature = false,
  loadTableGuestLocaleForRoute = false,
  children,
}: Readonly<{
  features?: Partial<TableGuestFeatureState>;
  readPublicTableGuestFeature?: boolean;
  loadTableGuestLocaleForRoute?: boolean;
  children: ReactNode;
}>) {
  const { i18n } = useTranslation();
  const [publicFeature, setPublicFeature] = useState<{ enabled: boolean; status: TableGuestFeatureStatus }>({
    enabled: false,
    status: 'idle',
  });
  const [guestStringsStatus, setGuestStringsStatus] = useState<TableGuestFeatureStatus>('idle');
  const [retryGeneration, setRetryGeneration] = useState(0);
  const publicFeatureRequest = useRef<Promise<PublicTableGuestFeatureResult> | null>(null);
  const retryTableGuestFeature = useCallback(() => {
    publicFeatureRequest.current = null;
    setPublicFeature((current) => ({ ...current, status: 'loading' }));
    setGuestStringsStatus('idle');
    setRetryGeneration((current) => current + 1);
  }, []);
  const hasStoredVisit = hasStoredTableGuestState();
  const featureSettled = publicFeature.status === 'ready' || publicFeature.status === 'unavailable';
  const shouldLoadGuestStrings =
    loadTableGuestLocaleForRoute ||
    (readPublicTableGuestFeature
      ? (publicFeature.status === 'ready' && publicFeature.enabled) || (featureSettled && hasStoredVisit)
      : features?.tableGuestVisitsV1 === true);

  useEffect(() => {
    if (!readPublicTableGuestFeature) {
      publicFeatureRequest.current = null;
      return;
    }
    let isCurrent = true;
    setPublicFeature({ enabled: false, status: 'loading' });
    publicFeatureRequest.current ??= import('@/services/publicTableGuestFeatureService').then(
      ({ getPublicTableGuestFeature }) => getPublicTableGuestFeature(),
    );
    void publicFeatureRequest.current
      .then((result) => {
        if (isCurrent) {
          setPublicFeature({ enabled: result.enabled, status: result.available ? 'ready' : 'unavailable' });
        }
      })
      .catch(() => {
        if (isCurrent) setPublicFeature({ enabled: false, status: 'unavailable' });
      });
    return () => {
      isCurrent = false;
    };
  }, [readPublicTableGuestFeature, retryGeneration]);

  useEffect(() => {
    if (!shouldLoadGuestStrings) {
      setGuestStringsStatus('idle');
      return;
    }
    if (!i18n) {
      setGuestStringsStatus('unavailable');
      return;
    }

    let isCurrent = true;
    setGuestStringsStatus('loading');
    void import('@/services/tableGuestLocaleService')
      .then(({ loadTableGuestLocale }) => loadTableGuestLocale(i18n, i18n.resolvedLanguage ?? i18n.language))
      .then(() => {
        if (isCurrent) setGuestStringsStatus('ready');
      })
      .catch(() => {
        if (isCurrent) setGuestStringsStatus('unavailable');
      });
    return () => {
      isCurrent = false;
    };
  }, [i18n, i18n?.language, retryGeneration, shouldLoadGuestStrings]);

  const staticFeatureStatus =
    features?.tableGuestVisitsV1 === undefined ? 'idle' : features.tableGuestVisitsV1 ? guestStringsStatus : 'ready';
  const publicFeatureStatus = resolvePublicFeatureStatus(
    publicFeature.status,
    guestStringsStatus,
    shouldLoadGuestStrings,
  );
  const value = useMemo<TableGuestFeatureState>(
    () => ({
      ...DEFAULT_FEATURE,
      ...features,
      tableGuestVisitsV1: readPublicTableGuestFeature ? publicFeature.enabled : (features?.tableGuestVisitsV1 ?? false),
      tableGuestFeatureStatus: readPublicTableGuestFeature ? publicFeatureStatus : staticFeatureStatus,
      hasStoredGuestState: hasStoredVisit,
      retryVersion: retryGeneration,
      retryTableGuestFeature,
    }),
    [
      features,
      publicFeature,
      publicFeatureStatus,
      readPublicTableGuestFeature,
      hasStoredVisit,
      retryTableGuestFeature,
      retryGeneration,
      staticFeatureStatus,
    ],
  );

  return <TableGuestFeatureContext.Provider value={value}>{children}</TableGuestFeatureContext.Provider>;
}

function resolvePublicFeatureStatus(
  featureStatus: TableGuestFeatureStatus,
  stringsStatus: TableGuestFeatureStatus,
  stringsRequired: boolean,
): TableGuestFeatureStatus {
  if (featureStatus === 'idle' || featureStatus === 'loading') return 'loading';
  if (!stringsRequired) return featureStatus === 'unavailable' ? 'unavailable' : 'ready';
  if (stringsStatus === 'unavailable') return 'unavailable';
  if (stringsStatus === 'ready') return featureStatus === 'unavailable' ? 'unavailable' : 'ready';
  return 'loading';
}

export function useTableGuestFeature(): TableGuestFeatureState {
  return useContext(TableGuestFeatureContext);
}
