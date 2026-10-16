'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCashierOrderGroups, getCashierTenantContext } from '@/services/cashierService';
import type { CashierQueueState } from '@/types/cashier';
import { CASHIER_TENANT_DAY_REFRESH_MS } from '@/lib/config';
import { getErrorMessage } from '@/utils/apiClient';

const OPERATIONAL_COUNT_QUERY = {
  scope: 'All' as const,
  page: 1,
  pageSize: 1,
};

const STATUS_MESSAGE_KEYS: Record<CashierQueueState, string> = {
  loading: 'cashier.workspace.open_count_loading',
  ready: 'cashier.workspace.open_count_current',
  stale: 'cashier.workspace.open_count_stale',
  unavailable: 'cashier.workspace.open_count_unavailable',
};

export interface CashierOperationalCount {
  readonly count: number | undefined;
  readonly state: CashierQueueState;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly statusMessageKey: string;
  readonly refreshCount: () => Promise<boolean>;
}

/**
 * Reads today's server-scoped order total for the workspace badge. It intentionally asks for one
 * row: totalCount is the server-owned count, while the workspace's filtered queue owns its rows.
 */
export function useCashierOperationalCount(): CashierOperationalCount {
  const [count, setCount] = useState<number | undefined>(undefined);
  const countRef = useRef<number | undefined>(undefined);
  const [state, setState] = useState<CashierQueueState>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const refreshCount = useCallback(async () => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const tenant = await getCashierTenantContext();
      if (!tenant?.date) throw new Error('Tenant business day is unavailable');
      const response = await getCashierOrderGroups({ ...OPERATIONAL_COUNT_QUERY, tenantDay: tenant.date });
      if (requestId !== requestRef.current) return false;
      if (!Number.isSafeInteger(response.totalCount) || response.totalCount < 0) {
        throw new Error('Invalid operational order count');
      }
      countRef.current = response.totalCount;
      setCount(response.totalCount);
      setError(null);
      setState('ready');
      setIsLoading(false);
      return true;
    } catch (reason: unknown) {
      if (requestId !== requestRef.current) return false;
      setError(getErrorMessage(reason) ?? 'cashier.workspace.open_count_unavailable');
      setState(countRef.current === undefined ? 'unavailable' : 'stale');
      setIsLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void refreshCount(), CASHIER_TENANT_DAY_REFRESH_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
      requestRef.current += 1;
    };
  }, [refreshCount]);

  return {
    count,
    state,
    isLoading,
    error,
    statusMessageKey: STATUS_MESSAGE_KEYS[state],
    refreshCount,
  };
}
