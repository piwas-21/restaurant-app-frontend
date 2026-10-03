'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tableGuestVisitService } from '@/services/tableGuestVisitService';
import {
  blockStoredVisit,
  clearPendingTableGuestRound,
  leaveStoredVisitIfNoPendingRound,
  readPendingTableGuestRoundForRecovery,
  readStoredTableGuestState,
  writePendingTableGuestRound,
  writeTableGuestVisit,
  type StoredTableGuestState,
} from '@/services/tableGuestVisitStorage';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitContext, type TableGuestVisitContextValue } from './TableGuestVisitContext';
import { isUnexpiredIdentity, recordVisitServiceFailure } from './tableGuestVisitRules';
import { resolveTableGuestVisitPhase } from './tableGuestVisitPhase';
import type {
  PendingTableGuestRound,
  TableGuestRoundAcknowledgement,
  TableGuestRoundRequest,
} from '@/types/tableGuestVisit';

export function TableGuestVisitProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { tableGuestVisitsV1, tableGuestFeatureStatus, retryVersion } = useTableGuestFeature();
  const [storedState, setStoredState] = useState<StoredTableGuestState>({ kind: 'none' });
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingRound, setPendingRound] = useState<PendingTableGuestRound | null>(null);
  const [pendingRoundStatus, setPendingRoundStatus] = useState<'known' | 'unknown'>('unknown');
  const [visitUnavailable, setVisitUnavailable] = useState(false);
  const [lastRoundAcknowledgement, setLastRoundAcknowledgement] = useState<TableGuestRoundAcknowledgement | null>(null);
  const observedRetryVersion = useRef(retryVersion);
  const pendingRetryVersion = useRef<number | null>(null);

  useEffect(() => {
    const stored = readStoredTableGuestState();
    setStoredState(stored);
    const pendingRead = readPendingTableGuestRoundForRecovery();
    setPendingRound(pendingRead.kind === 'pending' ? pendingRead.round : null);
    setPendingRoundStatus(pendingRead.kind === 'unavailable' ? 'unknown' : 'known');
    setIsHydrated(true);
  }, []);

  const markVisitUnavailable = useCallback((reason: 'ended' | 'unavailable' = 'unavailable') => {
    if (reason === 'ended') {
      blockStoredVisit(reason);
      setStoredState({ kind: 'blocked', reason });
      setVisitUnavailable(false);
    } else {
      // One non-enumerating 404 covers disabled, closed, and unknown visits; it cannot
      // prove that a lost-response round did not commit, so keep the stored evidence.
      setVisitUnavailable(true);
    }
    setLastRoundAcknowledgement(null);
  }, []);

  useEffect(() => {
    if (observedRetryVersion.current !== retryVersion) {
      observedRetryVersion.current = retryVersion;
      pendingRetryVersion.current = retryVersion;
    }
    if (
      pendingRetryVersion.current === null ||
      tableGuestFeatureStatus === 'idle' ||
      tableGuestFeatureStatus === 'loading'
    )
      return;
    if (tableGuestFeatureStatus === 'ready' && tableGuestVisitsV1) setVisitUnavailable(false);
    pendingRetryVersion.current = null;
  }, [retryVersion, tableGuestFeatureStatus, tableGuestVisitsV1]);

  useEffect(() => {
    if (storedState.kind !== 'visit') return;
    let timer: number | undefined;
    const endAtExpiry = () => {
      const remainingMs = new Date(storedState.identity.expiresAt).getTime() - Date.now();
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        markVisitUnavailable('ended');
        return;
      }
      timer = window.setTimeout(endAtExpiry, Math.min(remainingMs, 2_147_483_647));
    };
    endAtExpiry();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [markVisitUnavailable, storedState]);

  const joinVisit = useCallback(
    async (qrCodeData: string, admissionCode: string) => {
      if (!isHydrated || tableGuestFeatureStatus !== 'ready' || !tableGuestVisitsV1) {
        throw new Error('Table visit joining is unavailable.');
      }
      if (storedState.kind !== 'none' || pendingRound !== null || pendingRoundStatus === 'unknown') {
        throw new Error('Leave the previous table visit before joining another one.');
      }
      const identity = await tableGuestVisitService.joinTableGuestVisit(qrCodeData, admissionCode);
      if (!isUnexpiredIdentity(identity))
        throw new Error('This table visit has expired. Ask staff to create a new code.');
      if (!writeTableGuestVisit(identity)) {
        setStoredState({ kind: 'storageUnavailable' });
        const pendingRead = readPendingTableGuestRoundForRecovery();
        setPendingRound(pendingRead.kind === 'pending' ? pendingRead.round : null);
        setPendingRoundStatus(pendingRead.kind === 'unavailable' ? 'unknown' : 'known');
        throw new Error('This browser cannot safely keep the table visit open.');
      }
      setStoredState({ kind: 'visit', identity });
      setPendingRound(null);
      setPendingRoundStatus('known');
      setVisitUnavailable(false);
      setLastRoundAcknowledgement(null);
      return identity;
    },
    [isHydrated, pendingRound, pendingRoundStatus, storedState.kind, tableGuestFeatureStatus, tableGuestVisitsV1],
  );

  const getAccount = useCallback(async () => {
    if (storedState.kind !== 'visit' || tableGuestFeatureStatus !== 'ready' || !tableGuestVisitsV1) {
      throw new Error('Table visit is no longer available.');
    }
    if (!isUnexpiredIdentity(storedState.identity)) {
      markVisitUnavailable('ended');
      throw new Error('Table visit is no longer available.');
    }
    try {
      return await tableGuestVisitService.getTableGuestAccount(storedState.identity);
    } catch (error) {
      recordVisitServiceFailure(error, markVisitUnavailable);
      throw error;
    }
  }, [markVisitUnavailable, storedState, tableGuestFeatureStatus, tableGuestVisitsV1]);

  const createRound = useCallback(
    async (request: TableGuestRoundRequest) => {
      if (storedState.kind !== 'visit' || tableGuestFeatureStatus !== 'ready' || !tableGuestVisitsV1) {
        throw new Error('Table visit is no longer available.');
      }
      if (
        pendingRoundStatus === 'unknown' ||
        (pendingRound !== null && pendingRound.serviceSessionId !== storedState.identity.serviceSessionId)
      ) {
        throw new Error('A previous table round cannot be safely resolved.');
      }
      if (!isUnexpiredIdentity(storedState.identity)) {
        markVisitUnavailable('ended');
        throw new Error('Table visit is no longer available.');
      }
      try {
        return await tableGuestVisitService.createTableGuestRound(storedState.identity, request);
      } catch (error) {
        recordVisitServiceFailure(error, markVisitUnavailable);
        throw error;
      }
    },
    [markVisitUnavailable, pendingRound, pendingRoundStatus, storedState, tableGuestFeatureStatus, tableGuestVisitsV1],
  );

  const savePendingRound = useCallback(
    (attempt: PendingTableGuestRound) => {
      if (pendingRoundStatus === 'unknown' || pendingRound !== null) return false;
      const saved = writePendingTableGuestRound(attempt);
      if (saved) {
        setPendingRound(attempt);
        setPendingRoundStatus('known');
      }
      return saved;
    },
    [pendingRound, pendingRoundStatus],
  );

  const clearPendingRound = useCallback(() => {
    if (pendingRoundStatus === 'unknown') return;
    clearPendingTableGuestRound();
    setPendingRound(null);
    setPendingRoundStatus('known');
  }, [pendingRoundStatus]);

  const recordRoundAcknowledgement = useCallback(() => {
    setLastRoundAcknowledgement({ message: 'committed', at: Date.now() });
  }, []);

  const leaveAfterSafeDeparture = useCallback(() => {
    if (pendingRound !== null || pendingRoundStatus === 'unknown') return false;
    if (!leaveStoredVisitIfNoPendingRound()) {
      const pendingRead = readPendingTableGuestRoundForRecovery();
      setPendingRound(pendingRead.kind === 'pending' ? pendingRead.round : null);
      setPendingRoundStatus(pendingRead.kind === 'unavailable' ? 'unknown' : 'known');
      return false;
    }
    setStoredState({ kind: 'none' });
    setPendingRound(null);
    setPendingRoundStatus('known');
    setVisitUnavailable(false);
    setLastRoundAcknowledgement(null);
    return true;
  }, [pendingRound, pendingRoundStatus]);

  const resolvedPhase = resolveTableGuestVisitPhase(
    isHydrated,
    storedState,
    tableGuestFeatureStatus,
    tableGuestVisitsV1,
    visitUnavailable,
  );
  const hasUnresolvedPendingRound = pendingRound !== null || pendingRoundStatus === 'unknown';
  const phase = resolvedPhase === 'notJoined' && hasUnresolvedPendingRound ? 'unavailable' : resolvedPhase;
  const value = useMemo<TableGuestVisitContextValue>(
    () => ({
      phase,
      visit: storedState.kind === 'visit' && phase === 'active' ? storedState.identity : null,
      featureEnabled: tableGuestVisitsV1 && tableGuestFeatureStatus === 'ready',
      featureStatus: tableGuestFeatureStatus,
      pendingRound,
      pendingRoundStatus,
      requiresSafeDeparture: phase === 'ended',
      lastRoundAcknowledgement,
      joinVisit,
      getAccount,
      createRound,
      savePendingRound,
      clearPendingRound,
      markVisitUnavailable,
      leaveAfterSafeDeparture,
      recordRoundAcknowledgement,
    }),
    [
      phase,
      storedState,
      tableGuestVisitsV1,
      tableGuestFeatureStatus,
      pendingRound,
      pendingRoundStatus,
      lastRoundAcknowledgement,
      joinVisit,
      getAccount,
      createRound,
      savePendingRound,
      clearPendingRound,
      markVisitUnavailable,
      leaveAfterSafeDeparture,
      recordRoundAcknowledgement,
    ],
  );

  return <TableGuestVisitContext.Provider value={value}>{children}</TableGuestVisitContext.Provider>;
}
