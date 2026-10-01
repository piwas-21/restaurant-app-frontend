'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/utils/apiClient';
import { getChannelDecision, queueChannelDecision } from '@/services/channelDecisionService';
import type { ChannelDecisionDto, ChannelDecisionRequest } from '@/types/order/channelDecision';

const POLL_MILLISECONDS = 5000;
interface DecisionView {
  orderId: string;
  decision: ChannelDecisionDto | null;
  loading: boolean;
  saving: boolean;
  error: unknown;
}
const emptyView = (orderId: string): DecisionView => ({
  orderId,
  decision: null,
  loading: true,
  saving: false,
  error: false,
});

export function useChannelDecision(orderId: string, enabled: boolean, onChanged?: () => void) {
  const [view, setView] = useState<DecisionView>(() => emptyView(orderId));
  const [refresh, setRefresh] = useState(0);
  const [rejectedVersion, setRejectedVersion] = useState<{ orderId: string; version: number } | null>(null);
  const requests = useRef(new Map<string, ChannelDecisionRequest>());
  const submitting = useRef(new Set<string>());
  const generations = useRef(new Map<string, number>());
  const active = useRef({ orderId, enabled });
  active.current = { orderId, enabled };
  const notify = useRef(onChanged);
  notify.current = onChanged;
  const lastTerminal = useRef(new Map<string, string>());

  const showDecision = useCallback((id: string, decision: ChannelDecisionDto | null) => {
    if (!active.current.enabled || active.current.orderId !== id) return;
    setView({ orderId: id, decision, loading: false, saving: false, error: false });
    if (decision?.state === 'Succeeded' || decision?.state === 'Failed') {
      const signature = `${decision.operationId}:${decision.state}`;
      if (lastTerminal.current.get(id) !== signature) {
        lastTerminal.current.set(id, signature);
        notify.current?.();
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setView(emptyView(orderId));
    const poll = async () => {
      const generation = generations.current.get(orderId);
      try {
        const decision = await getChannelDecision(orderId);
        if (current && generation === generations.current.get(orderId) && !submitting.current.has(orderId))
          showDecision(orderId, decision);
      } catch (error) {
        if (current && generation === generations.current.get(orderId) && !submitting.current.has(orderId))
          setView((previous) => ({ ...previous, orderId, loading: false, error }));
      } finally {
        if (current) timer = setTimeout(() => void poll(), POLL_MILLISECONDS);
      }
    };
    void poll();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [enabled, orderId, refresh, showDecision]);

  const submit = async (request: Omit<ChannelDecisionRequest, 'operationId'>) => {
    if (!enabled || submitting.current.has(orderId)) return;
    // Freeze the first request, including version/reason, until its uncertain response is resolved.
    const frozen = requests.current.get(orderId) ?? { ...request, operationId: crypto.randomUUID() };
    requests.current.set(orderId, frozen);
    submitting.current.add(orderId);
    generations.current.set(orderId, (generations.current.get(orderId) ?? 0) + 1);
    setView((previous) => ({ ...previous, orderId, saving: true, error: false }));
    try {
      showDecision(orderId, await queueChannelDecision(orderId, frozen));
    } catch (error) {
      if (error instanceof ApiError && [400, 401, 403, 404, 409, 413, 422].includes(error.status))
        requests.current.delete(orderId);
      if (error instanceof ApiError && error.status === 409) {
        setRejectedVersion({ orderId, version: frozen.expectedVersion });
        if (active.current.orderId === orderId && active.current.enabled) notify.current?.();
      }
      if (active.current.orderId === orderId && active.current.enabled)
        setView((previous) => ({ ...previous, saving: false, error }));
    } finally {
      submitting.current.delete(orderId);
    }
  };

  return {
    ...(view.orderId === orderId ? view : emptyView(orderId)),
    uncertain: requests.current.has(orderId) && view.orderId === orderId && !view.decision,
    rejectedVersion: rejectedVersion?.orderId === orderId ? rejectedVersion.version : undefined,
    submit,
    retry: () => {
      const request = requests.current.get(orderId);
      if (request) void submit(request);
    },
    reload: () => {
      notify.current?.();
      setRefresh((value) => value + 1);
    },
  };
}
