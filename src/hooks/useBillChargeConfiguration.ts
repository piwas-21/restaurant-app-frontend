'use client';
import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { getBillCharges } from '@/services/billChargeService';
import type { BillChargeConfiguration } from '@/types/billCharge';

export function useBillChargeConfiguration() {
  const [configuration, setConfiguration] = useState<BillChargeConfiguration | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setConfiguration(await getBillCharges());
      setFailed(false);
      setMessage(null);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error));
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { configuration, setConfiguration, failed, message, refresh };
}
