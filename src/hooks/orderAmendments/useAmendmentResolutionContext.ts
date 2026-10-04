'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAmendmentResolutionContext } from '@/services/amendmentResolutionContextService';
import type { AmendmentResolutionContext } from '@/schemas/amendmentResolutionContext.schema';

interface Input {
  readonly orderId: string;
  readonly amendmentId: string;
  readonly enabled: boolean;
  readonly expected?: { readonly currency: string; readonly creditMinor: number };
}

/** Mount by actor/order/amendment; a failed refresh cannot retain a usable stale quote context. */
export function useAmendmentResolutionContext({ orderId, amendmentId, enabled, expected }: Input) {
  const [state, setState] = useState<{ context?: AmendmentResolutionContext; loading: boolean; failed: boolean }>({
    loading: enabled,
    failed: false,
  });
  const generation = useRef(0);
  const mounted = useRef(false);
  const currency = expected?.currency;
  const creditMinor = expected?.creditMinor;
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    let succeeded = false;
    setState({ loading: true, failed: false });
    try {
      const context = await getAmendmentResolutionContext(
        orderId,
        amendmentId,
        currency !== undefined && creditMinor !== undefined ? { currency, creditMinor } : undefined,
      );
      succeeded = true;
      if (mounted.current && generation.current === current) setState({ context, loading: false, failed: false });
    } catch (_contextError: unknown) {
      // Fresh context must remain unavailable after a failed read; private errors stay unlogged.
    } finally {
      if (mounted.current && generation.current === current) {
        setState((value) => (value.context ? value : { loading: false, failed: true }));
      }
    }
    if (!succeeded) throw new Error('resolution-context-unavailable');
  }, [amendmentId, creditMinor, currency, orderId]);

  useEffect(() => {
    mounted.current = true;
    if (enabled) void refresh().catch(() => undefined);
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [enabled, refresh]);
  return { ...state, refresh };
}
