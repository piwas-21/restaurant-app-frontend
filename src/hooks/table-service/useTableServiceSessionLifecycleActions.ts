'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { TableServiceSessionDto } from '@/types/order';
import {
  clearPendingTableServiceSessionOrders,
  closeTableServiceSession,
  getTableServiceSession,
  releaseTableServiceSession,
} from '@/services/tableServiceSessionService';
import {
  clearPendingTableOperation,
  persistPendingTableClose,
  type PendingTableOperation,
} from '@/lib/cashierTablePending';
import { getErrorMessage } from '@/utils/apiClient';
import { isPaymentOutcomeUnknown } from '@/hooks/cashier/usePaymentReconciliation';
import {
  beginTableSessionMutation,
  finishTableSessionMutation,
  isCurrentTableSessionMutation,
} from '@/hooks/cashier/tableSessionMutation';
import { tableServiceCloseErrorMessage } from './tableServiceSessionErrors';

interface Props {
  readonly serviceSessionId: string | null;
  readonly session: TableServiceSessionDto | null;
  readonly pendingOperation: PendingTableOperation | null;
  readonly refresh: () => Promise<void>;
  readonly mountedRef: MutableRefObject<boolean>;
  readonly requestRef: MutableRefObject<number>;
  readonly operationRef: MutableRefObject<number>;
  readonly inFlightRef: MutableRefObject<boolean>;
  readonly setIsLoading: Dispatch<SetStateAction<boolean>>;
  readonly setIsMutating: Dispatch<SetStateAction<boolean>>;
  readonly setPendingOperation: Dispatch<SetStateAction<PendingTableOperation | null>>;
  readonly setIsStale: Dispatch<SetStateAction<boolean>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
  readonly setSession: Dispatch<SetStateAction<TableServiceSessionDto | null>>;
}

export function useTableServiceSessionLifecycleActions({
  serviceSessionId,
  session,
  pendingOperation,
  refresh,
  mountedRef,
  requestRef,
  operationRef,
  inFlightRef,
  setIsLoading,
  setIsMutating,
  setPendingOperation,
  setIsStale,
  setError,
  setSession,
}: Props) {
  const executeClose = useCallback(async (): Promise<TableServiceSessionDto> => {
    if (!serviceSessionId || !session) throw new Error('cashier.tables.session_required');
    if (pendingOperation || inFlightRef.current) throw new Error('cashier.tables.operation_pending');
    const expectedVersion = session.version;
    const operationId = beginTableSessionMutation(requestRef, inFlightRef, setIsLoading, operationRef);
    const current = () => isCurrentTableSessionMutation(mountedRef, operationRef, operationId);
    persistPendingTableClose(serviceSessionId, expectedVersion);
    setPendingOperation({ kind: 'close', serviceSessionId, expectedVersion, status: 'Checking' });
    setError(null);
    setIsMutating(true);
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
        const message = tableServiceCloseErrorMessage(reason);
        setError(message);
        void refresh().finally(() => {
          if (current()) setError(message);
        });
      }
      throw reason;
    } finally {
      finishTableSessionMutation(mountedRef, operationRef, inFlightRef, setIsMutating, operationId);
    }
  }, [
    inFlightRef,
    mountedRef,
    operationRef,
    pendingOperation,
    refresh,
    requestRef,
    serviceSessionId,
    session,
    setError,
    setIsLoading,
    setIsMutating,
    setIsStale,
    setPendingOperation,
    setSession,
  ]);

  const executeRelease = useCallback(async (): Promise<TableServiceSessionDto> => {
    if (!serviceSessionId || !session) throw new Error('cashier.tables.session_required');
    if (pendingOperation || inFlightRef.current) throw new Error('cashier.tables.operation_pending');
    const operationId = beginTableSessionMutation(requestRef, inFlightRef, setIsLoading, operationRef);
    const current = () => isCurrentTableSessionMutation(mountedRef, operationRef, operationId);
    setIsMutating(true);
    setError(null);
    try {
      const result = await releaseTableServiceSession(serviceSessionId, { expectedVersion: session.version });
      if (!current()) throw new Error('cashier.tables.operation_stale');
      setSession(result);
      setIsStale(false);
      return result;
    } catch (reason: unknown) {
      if (!current()) throw reason;
      const message = getErrorMessage(reason) ?? 'cashier.tables.release_failed';
      setError(message);
      void refresh().finally(() => {
        if (current()) setError(message);
      });
      throw reason;
    } finally {
      finishTableSessionMutation(mountedRef, operationRef, inFlightRef, setIsMutating, operationId);
    }
  }, [
    inFlightRef,
    mountedRef,
    operationRef,
    pendingOperation,
    refresh,
    requestRef,
    serviceSessionId,
    session,
    setError,
    setIsLoading,
    setIsMutating,
    setIsStale,
    setSession,
  ]);

  const executeClearAndRelease = useCallback(async (): Promise<TableServiceSessionDto> => {
    if (!serviceSessionId || !session) throw new Error('cashier.tables.session_required');
    if (pendingOperation || inFlightRef.current) throw new Error('cashier.tables.operation_pending');
    const operationId = beginTableSessionMutation(requestRef, inFlightRef, setIsLoading, operationRef);
    const current = () => isCurrentTableSessionMutation(mountedRef, operationRef, operationId);
    setIsMutating(true);
    setError(null);
    try {
      await clearPendingTableServiceSessionOrders(serviceSessionId, { expectedVersion: session.version });
      const result = await getTableServiceSession(serviceSessionId);
      if (!current()) throw new Error('cashier.tables.operation_stale');
      setSession(result);
      setIsStale(false);
      return result;
    } catch (reason: unknown) {
      if (!current()) throw reason;
      const message = getErrorMessage(reason) ?? 'cashier.tables.clear_failed';
      setError(message);
      void refresh().finally(() => {
        if (current()) setError(message);
      });
      throw reason;
    } finally {
      finishTableSessionMutation(mountedRef, operationRef, inFlightRef, setIsMutating, operationId);
    }
  }, [
    inFlightRef,
    mountedRef,
    operationRef,
    pendingOperation,
    refresh,
    requestRef,
    serviceSessionId,
    session,
    setError,
    setIsLoading,
    setIsMutating,
    setIsStale,
    setSession,
  ]);

  return { executeClose, executeRelease, executeClearAndRelease };
}
