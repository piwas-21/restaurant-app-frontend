'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { getBillCharges } from '@/services/billChargeService';
import type { BillChargeConfiguration } from '@/types/billCharge';

export function useBillChargeConfiguration() {
  const [configuration, setConfiguration] = useState<BillChargeConfiguration | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const result = await getBillCharges();
      if (request !== generation.current) return;
      setConfiguration(result);
      setFailed(false);
      setMessage(null);
    } catch (error: unknown) {
      if (request !== generation.current) return;
      setMessage(getErrorMessage(error));
      setFailed(true);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);
  return { configuration, setConfiguration, failed, loading, message, refresh };
}
