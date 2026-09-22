import type { ConnectionState } from '@/lib/operationalStatus';
import type { TableServiceSessionDto } from '@/types/order';
import {
  isKnownServerFloorTableState,
  type ServerFloorTable,
  type ServerFloorTableState,
} from '@/types/serverWorkspace';

export type ServerTableBlocker =
  'none' | 'loading' | 'unavailable' | 'stale' | 'reserved' | 'inactive' | 'ambiguous' | 'legacy' | 'missing-session';

export interface ServerTableSessionState {
  readonly table: ServerFloorTable | null;
  readonly session: TableServiceSessionDto | null;
  readonly isLoading: boolean;
  readonly isStarting: boolean;
  readonly isStale: boolean;
  readonly error: string | null;
  readonly blocker: ServerTableBlocker;
  readonly floorConnectionState: ConnectionState;
  readonly floorLastConfirmed: string | null | undefined;
  readonly refresh: () => Promise<void>;
  readonly startTable: () => Promise<TableServiceSessionDto>;
  readonly canStartTable: boolean;
  readonly canAddRound: boolean;
}

export function blockerFor(
  table: ServerFloorTable | null,
  floorStale: boolean,
  session: TableServiceSessionDto | null,
  isLoading: boolean,
): ServerTableBlocker {
  if (!table) return isLoading ? 'loading' : 'unavailable';
  if (!isKnownServerFloorTableState(table.state)) return 'unavailable';
  if (floorStale) return 'stale';
  if (isLoading && !session) return 'loading';
  if (table.state === 'Reserved') return 'reserved';
  if (table.state === 'Inactive') return 'inactive';
  if (table.state === 'Ambiguous' || table.hasLegacyAmbiguity) return 'ambiguous';
  if (session?.hasUnassignedActiveOrders || table.legacy?.activeOrderCount) return 'legacy';
  if ((table.state === 'Open' || table.state === 'Ready') && !session) return 'missing-session';
  return 'none';
}

export function normalizeTableId(value: string): string {
  return value.trim();
}

export function tableStateForCopy(table: ServerFloorTable | null): ServerFloorTableState | null {
  return table && isKnownServerFloorTableState(table.state) ? table.state : null;
}
