'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTableServiceSession } from '@/hooks/table-service/useTableServiceSession';
import {
  cancelTableServicePaymentHandoff,
  requestTableServicePaymentHandoff,
} from '@/services/tableServiceSessionService';
import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { STAFF_PAYMENT_HANDOFF_REFRESH_MS } from '@/lib/config';

interface ServerTableBillActions {
  readonly session: TableServiceSessionDto | null;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly isStale: boolean;
  readonly error: string | null;
  readonly requestHandoff: () => Promise<void>;
  readonly cancelHandoff: () => Promise<void>;
  readonly submitPayment: (payment: AddTableServiceSessionPaymentRequest) => Promise<void>;
  readonly closeSession: () => Promise<void>;
  readonly reconcilePendingOperation: () => Promise<void>;
  readonly refresh: () => Promise<void>;
}

function newestSession(
  sessions: readonly (TableServiceSessionDto | null)[],
  serviceSessionId: string,
): TableServiceSessionDto | null {
  return sessions.reduce<TableServiceSessionDto | null>((current, candidate) => {
    if (!candidate || candidate.serviceSessionId !== serviceSessionId) return current;
    return !current || candidate.version >= current.version ? candidate : current;
  }, null);
}

export function useServerTableBillActions(
  baseSession: TableServiceSessionDto,
  refreshWorkspace: () => Promise<void>,
): ServerTableBillActions {
  const shared = useTableServiceSession(baseSession.serviceSessionId);
  const refreshSession = shared.refresh;
  const isSessionMutating = shared.isMutating;
  const [mutationSession, setMutationSession] = useState<TableServiceSessionDto | null>(null);
  const [handoffMutating, setHandoffMutating] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const requestOperationRef = useRef<string | null>(null);
  const cancelOperationRef = useRef<string | null>(null);
  const session = useMemo(
    () => newestSession([baseSession, shared.session, mutationSession], baseSession.serviceSessionId),
    [baseSession, mutationSession, shared.session],
  );

  useEffect(() => {
    setMutationSession(null);
    setHandoffError(null);
    requestOperationRef.current = null;
    cancelOperationRef.current = null;
  }, [baseSession.serviceSessionId]);

  useEffect(() => {
    if (isSessionMutating || handoffMutating) return;
    const interval = window.setInterval(() => void refreshSession(), STAFF_PAYMENT_HANDOFF_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [handoffMutating, isSessionMutating, refreshSession]);

  const refresh = useCallback(async () => {
    await Promise.all([shared.refresh(), refreshWorkspace()]);
  }, [refreshWorkspace, shared]);

  const runHandoff = useCallback(
    async (kind: 'request' | 'cancel') => {
      if (!session || handoffMutating || shared.isMutating) return;
      const operationRef = kind === 'request' ? requestOperationRef : cancelOperationRef;
      const operationId = (operationRef.current ??= crypto.randomUUID());
      setHandoffMutating(true);
      setHandoffError(null);
      try {
        const result = await (kind === 'request'
          ? requestTableServicePaymentHandoff(session.serviceSessionId, {
              operationId,
              expectedVersion: session.version,
            })
          : cancelTableServicePaymentHandoff(session.serviceSessionId, {
              operationId,
              expectedVersion: session.version,
            }));
        operationRef.current = null;
        setMutationSession(result);
        await refreshWorkspace();
      } catch (reason: unknown) {
        setHandoffError(getErrorMessage(reason) ?? 'server.bill.operation_failed');
        await Promise.allSettled([shared.refresh(), refreshWorkspace()]);
        throw reason;
      } finally {
        setHandoffMutating(false);
      }
    },
    [handoffMutating, refreshWorkspace, session, shared],
  );

  const submitPayment = useCallback(
    async (payment: AddTableServiceSessionPaymentRequest) => {
      const result = await shared.submitPayment(payment);
      setMutationSession(result);
      await refreshWorkspace();
    },
    [refreshWorkspace, shared],
  );

  const closeSession = useCallback(async () => {
    const result = await shared.closeSession();
    setMutationSession(result);
    await refreshWorkspace();
  }, [refreshWorkspace, shared]);

  return {
    session,
    isLoading: shared.isLoading,
    isMutating: shared.isMutating || handoffMutating,
    isStale: shared.isStale,
    error: handoffError ?? shared.error,
    requestHandoff: () => runHandoff('request'),
    cancelHandoff: () => runHandoff('cancel'),
    submitPayment,
    closeSession,
    reconcilePendingOperation: shared.reconcilePendingOperation,
    refresh,
  };
}
