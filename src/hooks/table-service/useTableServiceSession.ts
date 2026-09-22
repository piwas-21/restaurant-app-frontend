'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import {
  addTableServiceSessionPayment,
  closeTableServiceSession,
  getTableServiceSession,
} from '@/services/tableServiceSessionService';
import {
  clearPendingTableOperation,
  persistPendingTableClose,
  persistPendingTablePayment,
  readPendingTableOperation,
  type PendingTableOperation,
} from '@/lib/cashierTablePending';
import { getErrorMessage } from '@/utils/apiClient';
import { isPaymentOutcomeUnknown } from '@/hooks/cashier/usePaymentReconciliation';
import { reconcilePendingTableOperation } from '@/hooks/cashier/reconcilePendingTableOperation';
import type { TableServiceSessionState } from './tableServiceSessionTypes';
import {
  beginTableSessionMutation,
  finishTableSessionMutation,
  isCurrentTableSessionMutation,
} from '@/hooks/cashier/tableSessionMutation';
export type { TableServiceSessionState } from './tableServiceSessionTypes';
export function useTableServiceSession(serviceSessionId: string | null): TableServiceSessionState {
  const [session, setSession] = useState<TableServiceSessionDto | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(serviceSessionId));
  const [isMutating, setIsMutating] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingTableOperation | null>(() =>
    readPendingTableOperation(serviceSessionId),
  );
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const operationRef = useRef(0);
  const inFlightRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      operationRef.current += 1;
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!serviceSessionId) {
      setSession(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getTableServiceSession(serviceSessionId);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setSession(result);
      setIsStale(false);
    } catch (reason: unknown) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setIsStale(true);
      setError(getErrorMessage(reason) ?? 'cashier.tables.session_unavailable');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
    }
  }, [serviceSessionId]);
  useEffect(() => {
    requestRef.current += 1;
    operationRef.current += 1;
    setSession(null);
    setError(null);
    setIsStale(false);
    setPendingOperation(readPendingTableOperation(serviceSessionId));
    setIsMutating(false);
    setIsLoading(Boolean(serviceSessionId));
    inFlightRef.current = false;
    if (serviceSessionId) void refresh();
  }, [refresh, serviceSessionId]);
  useEffect(() => {
    if (typeof window === 'undefined' || (!pendingOperation && !isMutating)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isMutating, pendingOperation]);
  const executePayment = useCallback(
    async (payment: AddTableServiceSessionPaymentRequest): Promise<TableServiceSessionDto> => {
      if (!serviceSessionId || !session) throw new Error('cashier.tables.session_required');
      if (pendingOperation) throw new Error('cashier.tables.operation_pending');
      if (inFlightRef.current) throw new Error('cashier.tables.operation_pending');
      const operationId = beginTableSessionMutation(requestRef, inFlightRef, setIsLoading, operationRef);
      const current = () => isCurrentTableSessionMutation(mountedRef, operationRef, operationId);
      persistPendingTablePayment(serviceSessionId, payment);
      setPendingOperation({ kind: 'payment', serviceSessionId, ...payment, status: 'Checking' });
      setIsMutating(true);
      setError(null);
      try {
        const result = await addTableServiceSessionPayment(serviceSessionId, payment);
        if (!current()) throw new Error('cashier.tables.operation_stale');
        clearPendingTableOperation(serviceSessionId, payment.operationId);
        setPendingOperation(null);
        setSession(result);
        setIsStale(false);
        return result;
      } catch (reason: unknown) {
        if (!current()) throw reason;
        if (isPaymentOutcomeUnknown(reason)) {
          setPendingOperation({ kind: 'payment', serviceSessionId, ...payment, status: 'Unknown' });
          setError('cashier.tables.payment_unknown');
        } else {
          clearPendingTableOperation(serviceSessionId, payment.operationId);
          setPendingOperation(null);
          const message = getErrorMessage(reason) ?? 'cashier.tables.payment_failed';
          setError(message);
          void refresh().finally(() => {
            if (current()) setError(message);
          });
        }
        throw reason;
      } finally {
        finishTableSessionMutation(mountedRef, operationRef, inFlightRef, setIsMutating, operationId);
      }
    },
    [pendingOperation, refresh, serviceSessionId, session],
  );
  const executeClose = useCallback(async (): Promise<TableServiceSessionDto> => {
    if (!serviceSessionId || !session) throw new Error('cashier.tables.session_required');
    if (pendingOperation) throw new Error('cashier.tables.operation_pending');
    if (inFlightRef.current) throw new Error('cashier.tables.operation_pending');
    const expectedVersion = session.version;
    const operationId = beginTableSessionMutation(requestRef, inFlightRef, setIsLoading, operationRef);
    const current = () => isCurrentTableSessionMutation(mountedRef, operationRef, operationId);
    persistPendingTableClose(serviceSessionId, expectedVersion);
    setPendingOperation({ kind: 'close', serviceSessionId, expectedVersion, status: 'Checking' });
    setIsMutating(true);
    setError(null);
    try {
      const result = await closeTableServiceSession(serviceSessionId, { expectedVersion });
      if (!current()) throw new Error('cashier.tables.operation_stale');
      clearPendingTableOperation(serviceSessionId);
      setPendingOperation(null);
      setSession(result);
      setIsStale(false);
      return result;
    } catch (reason: unknown) {
      if (!current()) throw reason;
      if (isPaymentOutcomeUnknown(reason)) {
        setPendingOperation({ kind: 'close', serviceSessionId, expectedVersion, status: 'Unknown' });
        setError('cashier.tables.close_unknown');
      } else {
        clearPendingTableOperation(serviceSessionId);
        setPendingOperation(null);
        const message = getErrorMessage(reason) ?? 'cashier.tables.close_failed';
        setError(message);
        void refresh().finally(() => {
          if (current()) setError(message);
        });
      }
      throw reason;
    } finally {
      finishTableSessionMutation(mountedRef, operationRef, inFlightRef, setIsMutating, operationId);
    }
  }, [pendingOperation, refresh, serviceSessionId, session]);
  const reconcilePendingOperation = useCallback(async (): Promise<void> => {
    if (!serviceSessionId || pendingOperation?.status !== 'Unknown') return;
    if (inFlightRef.current) return;
    await reconcilePendingTableOperation({
      serviceSessionId,
      pendingOperation,
      mountedRef,
      requestRef,
      operationRef,
      inFlightRef,
      setIsLoading,
      setIsMutating,
      setPendingOperation,
      setSession,
      setIsStale,
      setError,
    });
  }, [pendingOperation, serviceSessionId]);
  return {
    session,
    isLoading,
    isMutating,
    isStale,
    error,
    pendingOperation,
    refresh,
    submitPayment: executePayment,
    closeSession: executeClose,
    reconcilePendingOperation,
  };
}
