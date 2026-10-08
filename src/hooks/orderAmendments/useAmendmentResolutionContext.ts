'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAmendmentResolutionContext } from '@/services/amendmentResolutionContextService';
import { prepareAmendmentEarningRetirement } from '@/services/amendmentEarningRetirementService';
import type { AmendmentResolutionContext } from '@/schemas/amendmentResolutionContext.schema';

interface Input {
  readonly actorId?: string;
  readonly orderId: string;
  readonly amendmentId: string;
  readonly enabled: boolean;
  readonly expected?: { readonly currency: string; readonly creditMinor: number };
  readonly onPrepared?: () => void;
}

async function refreshContextAfterRetirement(
  isCurrent: () => boolean,
  prepared: boolean,
  onPrepared: (() => void) | undefined,
  refresh: () => Promise<void>,
): Promise<boolean> {
  if (!isCurrent()) return false;
  if (prepared) onPrepared?.();
  if (!isCurrent()) return false;
  try {
    // A stale-version refusal refreshes the context but never replays its old request body.
    await refresh();
    return false;
  } catch (refreshError: unknown) {
    // The hook exposes a localized generic failure instead of potentially private server details.
    void refreshError;
    return true;
  }
}

/** Bind fresh resolution context and Admin preparation to the active actor/order/amendment flow. */
export function useAmendmentResolutionContext({ actorId, orderId, amendmentId, enabled, expected, onPrepared }: Input) {
  const [state, setState] = useState<{
    executionKey: string;
    context?: AmendmentResolutionContext;
    loading: boolean;
    failed: boolean;
  }>({
    executionKey: JSON.stringify([actorId ?? null, orderId, amendmentId, enabled]),
    loading: enabled,
    failed: false,
  });
  const generation = useRef(0);
  const lifecycleGeneration = useRef(0);
  const mounted = useRef(false);
  const scopeKey = JSON.stringify([actorId ?? null, orderId, amendmentId]);
  const executionKey = JSON.stringify([actorId ?? null, orderId, amendmentId, enabled]);
  const currentExecutionKey = useRef(executionKey);
  currentExecutionKey.current = executionKey;
  const retirementInFlight = useRef(new Map<string, number>());
  const retirementSequence = useRef(0);
  const [retiringOperation, setRetiringOperation] = useState<{
    scope: string;
    executionKey: string;
    operation: number;
  } | null>(null);
  const [retirementFailedKey, setRetirementFailedKey] = useState<string | null>(null);
  const currency = expected?.currency;
  const creditMinor = expected?.creditMinor;
  const refresh = useCallback(async () => {
    const requestedExecutionKey = executionKey;
    const current = ++generation.current;
    const isCurrent = () =>
      mounted.current && generation.current === current && currentExecutionKey.current === requestedExecutionKey;
    let succeeded = false;
    setState({ executionKey: requestedExecutionKey, loading: true, failed: false });
    try {
      const context = await getAmendmentResolutionContext(
        orderId,
        amendmentId,
        currency !== undefined && creditMinor !== undefined ? { currency, creditMinor } : undefined,
      );
      succeeded = true;
      if (isCurrent()) setState({ executionKey: requestedExecutionKey, context, loading: false, failed: false });
    } catch (_contextError: unknown) {
      // Fresh context must remain unavailable after a failed read; private errors stay unlogged.
    } finally {
      if (isCurrent()) {
        setState((value) =>
          value.executionKey === requestedExecutionKey && value.context
            ? value
            : { executionKey: requestedExecutionKey, loading: false, failed: true },
        );
      }
    }
    if (!succeeded) throw new Error('resolution-context-unavailable');
  }, [amendmentId, creditMinor, currency, executionKey, orderId]);

  const prepareEarningRetirement = useCallback(async () => {
    const current = state.executionKey === executionKey ? state.context : undefined;
    if (!enabled || !current?.earningRetirementRequired || retirementInFlight.current.has(scopeKey)) return;
    const requestScope = scopeKey;
    const requestExecutionKey = executionKey;
    const requestOperation = ++retirementSequence.current;
    const requestGeneration = lifecycleGeneration.current;
    const isCurrent = () =>
      mounted.current &&
      lifecycleGeneration.current === requestGeneration &&
      currentExecutionKey.current === requestExecutionKey;
    retirementInFlight.current.set(requestScope, requestOperation);
    setRetiringOperation({ scope: requestScope, executionKey: requestExecutionKey, operation: requestOperation });
    setRetirementFailedKey(null);
    let failed = false;
    let prepared = false;
    try {
      try {
        await prepareAmendmentEarningRetirement(orderId, amendmentId, current);
        prepared = true;
      } catch (retirementError: unknown) {
        // The modal exposes a localized generic failure instead of raw provider or server details.
        void retirementError;
        failed = true;
      }
      failed = (await refreshContextAfterRetirement(isCurrent, prepared, onPrepared, refresh)) || failed;
    } finally {
      if (retirementInFlight.current.get(requestScope) === requestOperation) {
        retirementInFlight.current.delete(requestScope);
      }
      if (mounted.current) {
        setRetiringOperation((pending) => (pending?.operation === requestOperation ? null : pending));
      }
      if (isCurrent()) {
        setRetirementFailedKey(failed ? requestExecutionKey : null);
      }
    }
  }, [amendmentId, enabled, executionKey, onPrepared, orderId, refresh, scopeKey, state.context, state.executionKey]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      lifecycleGeneration.current += 1;
      generation.current += 1;
    };
  }, [executionKey]);

  useEffect(() => {
    setState({ executionKey, loading: enabled, failed: false });
    if (enabled) void refresh().catch(() => undefined);
  }, [enabled, executionKey, refresh]);

  const currentState = state.executionKey === executionKey ? state : { executionKey, loading: enabled, failed: false };

  return {
    ...currentState,
    refresh,
    prepareEarningRetirement,
    retiring:
      enabled &&
      retiringOperation?.scope === scopeKey &&
      retiringOperation.executionKey === executionKey &&
      retirementInFlight.current.get(scopeKey) === retiringOperation.operation,
    retirementFailed: retirementFailedKey === executionKey,
  };
}
