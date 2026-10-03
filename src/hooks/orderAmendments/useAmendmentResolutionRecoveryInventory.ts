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
    let values: readonly AmendmentResolutionRecovery[] | null = null;
    try {
      values = await listAmendmentResolutionRecovery(actorId, orderId);
    } catch (_readError: unknown) {
      // Private API or mismatched-response details are withheld; the failed read is surfaced as unavailable below.
    }
    if (!mounted.current || requestGeneration !== generation.current) return;
    if (values === null) setInventory({ status: 'unavailable' });
    else if (values.length === 0) setInventory({ status: 'none' });
    else setInventory({ status: 'pending', values });
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
