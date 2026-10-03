'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createAccountEqualSharePlan,
  getAccountEqualSharePlan,
  getAccountPaymentOperation,
  quoteAccountPayment,
} from '@/services/accountPaymentsService';
import type {
  AccountPaymentOperation,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import {
  clearPendingAccountPayment,
  persistPendingAccountPayment,
  readPendingAccountPayment,
  type PendingAccountPayment,
} from '@/lib/pendingAccountPayment';
import useApiError from './useApiError';
import { accountPaymentMutationActions } from '@/lib/accountPaymentMutationActions';
import { accountPaymentResultTransition, type AccountPaymentResult } from '@/lib/accountPaymentResult';

export function useAccountPaymentOperation(
  actorId: string | undefined,
  serviceSessionId: string,
  enabled: boolean,
  refresh: () => Promise<void>,
) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingAccountPayment | null>(null);
  const [operation, setOperation] = useState<AccountPaymentOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const error = useApiError();
  const capture = error.capture;
  const show = error.show;
  const clear = error.clear;
  const inFlight = useRef(false);
  const generation = useRef(0);

  const accept = useCallback(
    async (saved: PendingAccountPayment, result: AccountPaymentResult) => {
      const transition = accountPaymentResultTransition(
        saved,
        result,
        serviceSessionId,
        t('accountPayments.identity_mismatch'),
      );
      setOperation(transition.operation);
      const stored = transition.terminal
        ? clearPendingAccountPayment(saved.actorId, serviceSessionId, saved.request.operationId)
        : persistPendingAccountPayment(transition.pending);
      if (!stored) {
        setStorageUnavailable(true);
        show(t('accountPayments.storage_unavailable'));
      } else setPending(transition.terminal ? null : transition.pending);
      await refresh();
    },
    [serviceSessionId, refresh, show, t],
  );

  const run = useCallback(
    async (
      saved: PendingAccountPayment,
      action: () => Promise<AccountPaymentResult>,
      write: boolean,
      allowFeatureOffRecovery = false,
    ) => {
      if (inFlight.current || !actorId || (write && ((!enabled && !allowFeatureOffRecovery) || storageUnavailable)))
        return;
      if (write && !persistPendingAccountPayment(saved)) {
        setStorageUnavailable(true);
        show(t('accountPayments.storage_unavailable'));
        return;
      }
      const current = generation.current;
      inFlight.current = true;
      setBusy(true);
      setPending(saved);
      clear();
      try {
        const result = await action();
        if (current === generation.current) await accept(saved, result);
      } catch (reason: unknown) {
        if (current === generation.current) capture(reason, { fallback: t('accountPayments.result_unknown') });
      } finally {
        if (current === generation.current) {
          inFlight.current = false;
          setBusy(false);
        }
      }
    },
    [actorId, enabled, storageUnavailable, accept, capture, clear, show, t],
  );

  const check = useCallback(
    async (saved = pending) => {
      if (!saved) return;
      await run(
        saved,
        () =>
          saved.kind === 'plan'
            ? getAccountEqualSharePlan(serviceSessionId, saved.request.operationId)
            : getAccountPaymentOperation(serviceSessionId, saved.request.operationId),
        false,
      );
    },
    [pending, run, serviceSessionId],
  );
  const checkRef = useRef(check);
  checkRef.current = check;

  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    setPending(null);
    setOperation(null);
    setReady(false);
    setStorageUnavailable(false);
    setBusy(false);
    if (!actorId) return;
    const saved = readPendingAccountPayment(actorId, serviceSessionId);
    if (saved.status === 'unavailable') {
      setStorageUnavailable(true);
      show(t('accountPayments.storage_unavailable'));
    } else if (saved.status === 'pending') {
      setPending(saved.value);
      void checkRef.current(saved.value);
    }
    setReady(true);
    return () => {
      generation.current += 1;
    };
  }, [actorId, serviceSessionId, show, t]);

  const quote = async (request: CreateAccountPaymentQuoteRequest) => {
    if (!actorId || !ready || pending) return;
    await run(
      { actorId, serviceSessionId, kind: 'payment', request, stage: 'quote' },
      () => quoteAccountPayment(serviceSessionId, request),
      true,
    );
  };
  const plan = async (request: CreateAccountEqualSharePlanRequest) => {
    if (!actorId || !ready || pending) return;
    await run(
      { actorId, serviceSessionId, kind: 'plan', request },
      () => createAccountEqualSharePlan(serviceSessionId, request),
      true,
    );
  };
  const retryPreview = async () => {
    if (!pending || operation || (pending.kind === 'payment' && pending.stage !== 'quote')) return;
    await run(
      pending,
      () =>
        pending.kind === 'plan'
          ? createAccountEqualSharePlan(serviceSessionId, pending.request)
          : quoteAccountPayment(serviceSessionId, pending.request),
      true,
    );
  };
  const discardPreview = () => {
    if (!actorId || busy || pending?.kind !== 'payment' || pending.stage !== 'quote' || operation) return;
    if (clearPendingAccountPayment(actorId, serviceSessionId, pending.request.operationId)) {
      setPending(null);
      clear();
    } else {
      setStorageUnavailable(true);
      show(t('accountPayments.storage_unavailable'));
    }
  };
  const mutations = accountPaymentMutationActions(pending, operation, serviceSessionId, run);

  return {
    pending,
    operation,
    busy,
    ready,
    storageUnavailable,
    error: error.message,
    check,
    quote,
    plan,
    ...mutations,
    retryPreview,
    discardPreview,
    canStart: enabled && ready && !pending && !busy && !storageUnavailable,
  };
}
