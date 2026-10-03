'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listAmendmentResolutionRecovery,
  type AmendmentResolutionRecovery,
} from '@/services/amendmentResolutionRecoveryService';

type Inventory =
  | { readonly status: 'checking' | 'unavailable' }
  | { readonly status: 'none' }
  | { readonly status: 'pending'; readonly values: readonly AmendmentResolutionRecovery[] };

/** Mount under the actor/order key. All requests are DB-only reads; storage restoration is explicit. */
export function useAmendmentResolutionRecoveryInventory(actorId: string, orderId: string) {
  const [inventory, setInventory] = useState<Inventory>({ status: 'checking' });
  const generation = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    setInventory({ status: 'checking' });
    try {
      const values = await listAmendmentResolutionRecovery(actorId, orderId);
      if (mounted.current && requestGeneration === generation.current)
        setInventory(values.length === 0 ? { status: 'none' } : { status: 'pending', values });
    } catch (_readError: unknown) {
      // An unavailable or mismatched read cannot authorize another refund or expose private API details.
      if (mounted.current && requestGeneration === generation.current) setInventory({ status: 'unavailable' });
    }
  }, [actorId, orderId]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [refresh]);
  return { inventory, refresh };
}
