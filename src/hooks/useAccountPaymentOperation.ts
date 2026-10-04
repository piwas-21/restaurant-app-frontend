'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAccountEqualSharePlan, getAccountPaymentOperation } from '@/services/accountPaymentsService';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import {
  clearPendingAccountPayment,
  persistPendingAccountPayment,
  readPendingAccountPayment,
  type PendingAccountPayment,
} from '@/lib/pendingAccountPayment';
import useApiError from './useApiError';
import { accountPaymentMutationActions } from '@/lib/accountPaymentMutationActions';
import { accountPaymentResultTransition, type AccountPaymentResult } from '@/lib/accountPaymentResult';
import { canRetryAccountPaymentCollection } from '@/lib/accountPaymentRecovery';
import { createAccountPaymentDraftActions } from '@/lib/accountPaymentDraftActions';

export function useAccountPaymentOperation(
  actorId: string | undefined,
  serviceSessionId: string,
  enabled: boolean,
  refresh: () => Promise<void>,
  recoveryEnabled = false,
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
      const currentActorId = actorId?.toLowerCase();
      if (
        inFlight.current ||
        !currentActorId ||
        saved.actorId.toLowerCase() !== currentActorId ||
        saved.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase() ||
        (write && ((!enabled && !allowFeatureOffRecovery) || storageUnavailable))
      )
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
    [actorId, enabled, serviceSessionId, storageUnavailable, accept, capture, clear, show, t],
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

  const draftActions = createAccountPaymentDraftActions({
    actorId,
    serviceSessionId,
    ready,
    pending,
    operation,
    busy,
    run,
    setPending,
    setStorageUnavailable,
    clearError: clear,
    showError: show,
    storageUnavailableMessage: t('accountPayments.storage_unavailable'),
  });
  const mutations = accountPaymentMutationActions(
    pending,
    operation,
    serviceSessionId,
    run,
    actorId,
    enabled,
    recoveryEnabled,
    busy,
    storageUnavailable,
  );

  const canRetryCollection = canRetryAccountPaymentCollection(
    actorId,
    serviceSessionId,
    pending,
    operation,
    recoveryEnabled,
    busy,
    storageUnavailable,
  );

  return {
    pending,
    operation,
    busy,
    ready,
    storageUnavailable,
    canRetryCollection,
    error: error.message,
    check,
    ...draftActions,
    ...mutations,
    canStart: enabled && ready && !pending && !busy && !storageUnavailable,
  };
}
