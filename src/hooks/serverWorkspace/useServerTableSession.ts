'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { getTableServiceSession, openTableServiceSession } from '@/services/tableServiceSessionService';
import type { TableServiceSessionDto } from '@/types/order';
import { blockerFor, normalizeTableId, type ServerTableSessionState } from './serverTableSessionState';
import { useServerFloorSnapshot } from './useServerFloorSnapshot';

export type { ServerTableBlocker, ServerTableSessionState } from './serverTableSessionState';

/**
 * Resolves floor identity first, then reads the explicit session route for the authoritative bill.
 * The floor snapshot is never used as a substitute for the session bill.
 */
export function useServerTableSession(tableId: string): ServerTableSessionState {
  const floor = useServerFloorSnapshot();
  const normalizedTableId = normalizeTableId(tableId);
  const table = useMemo(
    () => floor.snapshot?.tables.find((candidate) => candidate.tableId === normalizedTableId) ?? null,
    [floor.snapshot, normalizedTableId],
  );
  const sessionIdentity = table?.session?.serviceSessionId ?? null;
  const [session, setSession] = useState<TableServiceSessionDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const loadedIdentityRef = useRef<string | null>(null);
  const pendingOpenedSessionRef = useRef<{ sessionId: string; floorVersion: string | null } | null>(null);
  const floorVersion = floor.snapshot?.version ?? null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionIdentity) {
      if (mountedRef.current) {
        setSession(null);
        setIsLoading(false);
        setIsStale(false);
        setError(null);
        loadedIdentityRef.current = null;
      }
      return;
    }
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const next = await getTableServiceSession(sessionIdentity);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setSession(next);
      setIsStale(false);
      setError(null);
      loadedIdentityRef.current = sessionIdentity;
    } catch (reason: unknown) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setIsStale(true);
      setError(getErrorMessage(reason) ?? 'cashier.tables.session_unavailable');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
    }
  }, [sessionIdentity]);

  useEffect(() => {
    if (!sessionIdentity) {
      const pending = pendingOpenedSessionRef.current;
      if (
        pending &&
        session?.serviceSessionId === pending.sessionId &&
        (floor.isStale || floorVersion === pending.floorVersion)
      ) {
        return;
      }
      pendingOpenedSessionRef.current = null;
      setSession(null);
      setError(null);
      setIsStale(false);
      setIsLoading(false);
      loadedIdentityRef.current = null;
      return;
    }
    if (
      pendingOpenedSessionRef.current?.sessionId === sessionIdentity &&
      session?.serviceSessionId === sessionIdentity
    ) {
      pendingOpenedSessionRef.current = null;
      loadedIdentityRef.current = null;
      void refresh();
      return;
    }
    if (loadedIdentityRef.current === sessionIdentity && session?.serviceSessionId === sessionIdentity) return;
    void refresh();
  }, [floor.isStale, floorVersion, refresh, session, sessionIdentity]);

  const startTable = useCallback(async (): Promise<TableServiceSessionDto> => {
    if (!normalizedTableId || !table || floor.isStale || table.state !== 'Available') {
      throw new Error('cashier.tables.open_failed');
    }
    if (isStarting || isLoading) throw new Error('cashier.tables.operation_pending');
    const requestId = ++requestRef.current;
    setIsStarting(true);
    setError(null);
    try {
      const next = await openTableServiceSession({ tableId: normalizedTableId });
      if (!mountedRef.current || requestId !== requestRef.current) throw new Error('cashier.tables.operation_stale');
      pendingOpenedSessionRef.current = { sessionId: next.serviceSessionId, floorVersion };
      loadedIdentityRef.current = null;
      setSession(next);
      setIsStale(true);
      try {
        await floor.refresh();
      } catch (refreshError: unknown) {
        if (mountedRef.current && requestId === requestRef.current) {
          setError(getErrorMessage(refreshError) ?? 'cashier.tables.session_unavailable');
        }
      }
      return next;
    } catch (reason: unknown) {
      if (mountedRef.current && requestId === requestRef.current) {
        setError(getErrorMessage(reason) ?? 'cashier.tables.open_failed');
      }
      throw reason;
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsStarting(false);
    }
  }, [floor, floorVersion, isLoading, isStarting, normalizedTableId, table]);

  const blocker = blockerFor(table, floor.isStale || isStale, session, isLoading);
  const canStartTable =
    Boolean(table) &&
    blocker === 'none' &&
    table?.state === 'Available' &&
    table.permittedActions.includes('StartTable') &&
    !session &&
    !isLoading &&
    !isStarting;
  const canAddRound =
    Boolean(session) &&
    session?.status === 'Open' &&
    blocker === 'none' &&
    table?.permittedActions.includes('AddRound') === true &&
    !isLoading &&
    !isStarting &&
    !floor.isStale &&
    !isStale;

  return {
    table,
    session,
    isLoading: floor.isLoading || isLoading,
    isStarting,
    isStale: floor.isStale || isStale,
    error: floor.error ?? error,
    blocker,
    floorConnectionState: floor.connectionState,
    floorLastConfirmed: floor.snapshot?.serverTime,
    refresh: async () => {
      await Promise.all([floor.refresh(), refresh()]);
    },
    startTable,
    canStartTable,
    canAddRound,
  };
}
