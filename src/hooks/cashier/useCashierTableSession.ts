'use client';

import { useTableServiceSession } from '@/hooks/table-service/useTableServiceSession';
import type { TableServiceSessionState } from '@/hooks/table-service/tableServiceSessionTypes';
import type { TableServiceSessionDto } from '@/types/order';

export type CashierTableSessionState = TableServiceSessionState;

/** Compatibility entry point for existing Cashier screens. */
export function useCashierTableSession(
  serviceSessionId: string | null,
  initialSession?: TableServiceSessionDto | null,
): CashierTableSessionState {
  return useTableServiceSession(serviceSessionId, initialSession);
}
