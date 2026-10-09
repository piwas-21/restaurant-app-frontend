'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { TableServiceSessionDto } from '@/types/order';
import {
  clearLegacyTableOrders as clearLegacyOrders,
  repairLegacyTableServiceSession,
} from '@/services/tableServiceSessionService';
import { getErrorMessage } from '@/utils/apiClient';
import type { CashierTableEntry } from '@/lib/cashierTableEntries';

interface Props {
  readonly refresh: (options?: { allowInFlightMutation?: boolean }) => Promise<void>;
  readonly requestRef: MutableRefObject<number>;
  readonly mutationRef: MutableRefObject<number>;
  readonly inFlightRef: MutableRefObject<boolean>;
  readonly mountedRef: MutableRefObject<boolean>;
  readonly setIsLoading: Dispatch<SetStateAction<boolean>>;
  readonly setIsMutating: Dispatch<SetStateAction<boolean>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
  readonly setEntries: Dispatch<SetStateAction<CashierTableEntry[]>>;
  readonly setRepairSuccess: Dispatch<SetStateAction<boolean>>;
}

export function useCashierLegacyTableActions({
  refresh,
  requestRef,
  mutationRef,
  inFlightRef,
  mountedRef,
  setIsLoading,
  setIsMutating,
  setError,
  setEntries,
  setRepairSuccess,
}: Props) {
  const repairLegacyOrders = useCallback(
    async (tableId: string): Promise<TableServiceSessionDto> => {
      if (inFlightRef.current) throw new Error('cashier.tables.operation_pending');
      if (!tableId.trim()) {
        const refusal = new Error('cashier.tables.legacy_repair_failed');
        setError(refusal.message);
        setRepairSuccess(false);
        throw refusal;
      }
      const mutationId = ++mutationRef.current;
      requestRef.current += 1;
      setIsLoading(false);
      inFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      setRepairSuccess(false);
      try {
        const repaired = await repairLegacyTableServiceSession(tableId);
        if (mountedRef.current && mutationId === mutationRef.current) {
          setEntries((current) =>
            current.map((entry) =>
              entry.table.id === tableId ? { ...entry, session: repaired, status: 'occupied' } : entry,
            ),
          );
          setRepairSuccess(true);
        }
        return repaired;
      } catch (reason: unknown) {
        if (mountedRef.current && mutationId === mutationRef.current) {
          setError(getErrorMessage(reason) ?? 'cashier.tables.legacy_repair_failed');
        }
        throw reason;
      } finally {
        if (mutationId === mutationRef.current) {
          inFlightRef.current = false;
          if (mountedRef.current) setIsMutating(false);
        }
      }
    },
    [
      inFlightRef,
      mountedRef,
      mutationRef,
      requestRef,
      setEntries,
      setError,
      setIsLoading,
      setIsMutating,
      setRepairSuccess,
    ],
  );

  const clearLegacyTableOrders = useCallback(
    async (tableNumber: string): Promise<void> => {
      const numericTableNumber = Number(tableNumber);
      if (!Number.isSafeInteger(numericTableNumber) || numericTableNumber <= 0)
        throw new Error('cashier.tables.legacy_clear_unavailable');
      if (inFlightRef.current) throw new Error('cashier.tables.operation_pending');
      const mutationId = ++mutationRef.current;
      requestRef.current += 1;
      setIsLoading(false);
      inFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      try {
        await clearLegacyOrders(numericTableNumber);
        if (mountedRef.current && mutationId === mutationRef.current) await refresh({ allowInFlightMutation: true });
      } catch (reason: unknown) {
        if (mountedRef.current && mutationId === mutationRef.current)
          setError(getErrorMessage(reason) ?? 'cashier.tables.clear_failed');
        throw reason;
      } finally {
        if (mutationId === mutationRef.current) {
          inFlightRef.current = false;
          if (mountedRef.current) setIsMutating(false);
        }
      }
    },
    [inFlightRef, mountedRef, mutationRef, refresh, requestRef, setError, setIsLoading, setIsMutating],
  );

  return { repairLegacyOrders, clearLegacyTableOrders };
}
