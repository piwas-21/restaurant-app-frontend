'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAccountPaymentAccount } from '@/services/accountPaymentsService';
import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import useApiError from './useApiError';

export function useAccountPaymentAccount(serviceSessionId: string, enabled: boolean) {
  const { t } = useTranslation();
  const [account, setAccount] = useState<AccountPaymentAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(true);
  const error = useApiError();
  const sequence = useRef(0);
  const capture = error.capture;
  const clear = error.clear;
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const request = ++sequence.current;
    clear();
    setLoading(true);
    setStale(true);
    try {
      const response = await getAccountPaymentAccount(serviceSessionId);
      if (request !== sequence.current) return;
      if (response.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase()) {
        throw new Error(t('accountPayments.identity_mismatch'));
      }
      setAccount(response);
      setStale(false);
    } catch (reason: unknown) {
      if (request === sequence.current) capture(reason, { fallback: t('accountPayments.load_failed') });
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [enabled, serviceSessionId, capture, clear, t]);

  useEffect(() => {
    setAccount(null);
    void refresh();
    return () => {
      sequence.current += 1;
    };
  }, [refresh]);
  return { account, loading, stale, error: error.message, refresh };
}
