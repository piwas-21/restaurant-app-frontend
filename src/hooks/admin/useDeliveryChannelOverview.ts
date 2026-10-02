'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routeApiError } from '@/utils/apiFormErrors';
import {
  deliveryChannelManagementService,
  isDeliveryChannelModuleDisabled,
} from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelAvailability, DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import type { DeliveryChannelException } from '@/types/deliveryChannelExceptions';

type OverviewFailure = 'moduleDisabled' | 'unavailable' | null;

function updateSummary(
  result: PromiseSettledResult<DeliveryChannelManagementSummary>,
  setSummary: (value: DeliveryChannelManagementSummary) => void,
  setStale: (value: boolean) => void,
  setFailure: (value: OverviewFailure) => void,
) {
  if (result.status === 'fulfilled') {
    setSummary(result.value);
    setFailure(null);
  } else {
    setFailure(isDeliveryChannelModuleDisabled(result.reason) ? 'moduleDisabled' : 'unavailable');
  }
  setStale(result.status !== 'fulfilled');
}

function updateAvailability(
  result: PromiseSettledResult<DeliveryChannelAvailability>,
  setAvailability: (value: DeliveryChannelAvailability) => void,
  setStale: (value: boolean) => void,
) {
  if (result.status === 'fulfilled') setAvailability(result.value);
  setStale(result.status !== 'fulfilled');
}

function updateExceptions(
  result: PromiseSettledResult<Awaited<ReturnType<typeof deliveryChannelManagementService.getExceptions>>>,
  setExceptions: (value: readonly DeliveryChannelException[]) => void,
  setCursor: (value: string | null) => void,
  setCheckedAt: (value: string | null) => void,
  setStale: (value: boolean) => void,
) {
  if (result.status === 'fulfilled') {
    setExceptions(result.value.items);
    setCursor(result.value.nextCursor);
    setCheckedAt(result.value.checkedAt);
  }
  setStale(result.status !== 'fulfilled');
}

export function useDeliveryChannelOverview() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DeliveryChannelManagementSummary | null>(null);
  const [availability, setAvailability] = useState<DeliveryChannelAvailability | null>(null);
  const [exceptions, setExceptions] = useState<readonly DeliveryChannelException[]>([]);
  const [exceptionCursor, setExceptionCursor] = useState<string | null>(null);
  const [exceptionsCheckedAt, setExceptionsCheckedAt] = useState<string | null>(null);
  const [loadingMoreExceptions, setLoadingMoreExceptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<OverviewFailure>(null);
  const [summaryStale, setSummaryStale] = useState(false);
  const [availabilityStale, setAvailabilityStale] = useState(false);
  const [exceptionsStale, setExceptionsStale] = useState(false);
  const [exceptionErrorMessage, setExceptionErrorMessage] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const refreshInFlight = useRef<{
    readonly generation: number;
    readonly promise: Promise<{ summary: boolean; availability: boolean; fresh: boolean }>;
  } | null>(null);

  const refresh = useCallback((forceFresh = false) => {
    if (!forceFresh && refreshInFlight.current) return refreshInFlight.current.promise;
    const generation = ++requestSequence.current;
    const isCurrent = () => generation === requestSequence.current;
    setRefreshing(true);
    const request = (async () => {
      const [summaryResult, availabilityResult, exceptionResult] = await Promise.allSettled([
        deliveryChannelManagementService.getSummary(),
        deliveryChannelManagementService.getAvailability(),
        deliveryChannelManagementService.getExceptions(null),
      ]);

      if (isCurrent()) {
        updateSummary(summaryResult, setSummary, setSummaryStale, setFailure);
        updateAvailability(availabilityResult, setAvailability, setAvailabilityStale);
        updateExceptions(
          exceptionResult,
          setExceptions,
          setExceptionCursor,
          setExceptionsCheckedAt,
          setExceptionsStale,
        );
        if (exceptionResult.status === 'fulfilled') setExceptionErrorMessage(null);
        setLoading(false);
        setRefreshing(false);
      }
      return {
        summary: summaryResult.status === 'fulfilled',
        availability: availabilityResult.status === 'fulfilled',
        fresh: isCurrent(),
      };
    })();
    const entry = { generation, promise: request };
    refreshInFlight.current = entry;
    void request.finally(() => {
      if (refreshInFlight.current === entry) refreshInFlight.current = null;
    });
    return request;
  }, []);

  const loadMoreExceptions = useCallback(async () => {
    if (!exceptionCursor || exceptionsStale || loadingMoreExceptions) return;
    setLoadingMoreExceptions(true);
    try {
      const page = await deliveryChannelManagementService.getExceptions(exceptionCursor);
      setExceptions((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !known.has(item.id))];
      });
      setExceptionCursor(page.nextCursor);
      setExceptionsCheckedAt(page.checkedAt);
      setExceptionErrorMessage(null);
    } catch (cause) {
      setExceptionsStale(true);
      setExceptionErrorMessage(routeApiError(cause).rootMessage ?? t('deliveryChannels.exceptions.stale'));
    } finally {
      setLoadingMoreExceptions(false);
    }
  }, [exceptionCursor, exceptionsStale, loadingMoreExceptions, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return {
    summary,
    availability,
    exceptions,
    exceptionsCheckedAt,
    loading,
    refreshing,
    failure,
    isStale: summaryStale || availabilityStale || exceptionsStale,
    summaryStale,
    availabilityStale,
    exceptionsStale,
    exceptionErrorMessage,
    loadingMoreExceptions,
    hasMoreExceptions: Boolean(exceptionCursor),
    refresh,
    loadMoreExceptions,
  };
}
