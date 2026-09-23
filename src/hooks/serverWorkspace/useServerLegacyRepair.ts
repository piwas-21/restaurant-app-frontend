'use client';

import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { repairLegacyTableServiceSession } from '@/services/tableServiceSessionService';
import type { TableServiceSessionDto } from '@/types/order';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import { getErrorMessage } from '@/utils/apiClient';

interface Options {
  readonly table: ServerFloorTable | null;
  readonly session: TableServiceSessionDto | null;
  readonly normalizedTableId: string;
  readonly floorVersion: string | null;
  readonly floorIsStale: boolean;
  readonly refreshFloor: () => Promise<void>;
  readonly isLoading: boolean;
  readonly isStarting: boolean;
  readonly mountedRef: MutableRefObject<boolean>;
  readonly requestRef: MutableRefObject<number>;
  readonly pendingOpenedSessionRef: MutableRefObject<{
    sessionId: string;
    floorVersion: string | null;
  } | null>;
  readonly loadedIdentityRef: MutableRefObject<string | null>;
  readonly setSession: Dispatch<SetStateAction<TableServiceSessionDto | null>>;
  readonly setIsStale: Dispatch<SetStateAction<boolean>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
}

function canRepair(table: ServerFloorTable | null, session: TableServiceSessionDto | null, floorIsStale: boolean) {
  return Boolean(
    table &&
    !floorIsStale &&
    table.permittedActions.includes('ReviewLegacy') &&
    (table.state === 'Ambiguous' ||
      table.hasLegacyAmbiguity ||
      (table.legacy?.activeOrderCount ?? 0) > 0 ||
      session?.hasUnassignedActiveOrders),
  );
}

export function useServerLegacyRepair(options: Options) {
  const [isRepairingLegacyOrders, setIsRepairingLegacyOrders] = useState(false);
  const [repairSuccess, setRepairSuccess] = useState(false);
  const repairLegacyOrders = useCallback(async (): Promise<TableServiceSessionDto> => {
    if (!options.normalizedTableId || !canRepair(options.table, options.session, options.floorIsStale)) {
      throw new Error('cashier.tables.legacy_repair_failed');
    }
    if (isRepairingLegacyOrders || options.isStarting || options.isLoading) {
      throw new Error('cashier.tables.operation_pending');
    }
    const requestId = ++options.requestRef.current;
    setIsRepairingLegacyOrders(true);
    setRepairSuccess(false);
    options.setError(null);
    try {
      const repaired = await repairLegacyTableServiceSession(options.normalizedTableId);
      if (!options.mountedRef.current || requestId !== options.requestRef.current) {
        throw new Error('cashier.tables.operation_stale');
      }
      options.pendingOpenedSessionRef.current = {
        sessionId: repaired.serviceSessionId,
        floorVersion: options.floorVersion,
      };
      options.loadedIdentityRef.current = null;
      options.setSession(repaired);
      options.setIsStale(true);
      setRepairSuccess(true);
      try {
        await options.refreshFloor();
      } catch (refreshError: unknown) {
        if (options.mountedRef.current && requestId === options.requestRef.current) {
          options.setError(getErrorMessage(refreshError) ?? 'cashier.tables.session_unavailable');
        }
      }
      return repaired;
    } catch (reason: unknown) {
      if (options.mountedRef.current && requestId === options.requestRef.current) {
        options.setError(getErrorMessage(reason) ?? 'cashier.tables.legacy_repair_failed');
      }
      throw reason;
    } finally {
      if (options.mountedRef.current && requestId === options.requestRef.current) {
        setIsRepairingLegacyOrders(false);
      }
    }
  }, [isRepairingLegacyOrders, options]);

  return { isRepairingLegacyOrders, repairSuccess, repairLegacyOrders };
}
