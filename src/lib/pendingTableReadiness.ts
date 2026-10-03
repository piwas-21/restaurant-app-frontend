import { z } from 'zod';
import type { PendingTableReadiness } from '@/types/tableReadiness';

const descriptor = z
  .object({
    actorId: z.string().uuid(),
    actorRole: z.enum(['Admin', 'Cashier', 'Server']),
    tableId: z.string().uuid(),
    request: z
      .object({
        operationId: z.string().uuid(),
        expectedReadinessVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      })
      .strict(),
  })
  .strict();

export type PendingTableReadinessRead =
  | { readonly status: 'none' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'pending'; readonly value: PendingTableReadiness };

function key(actorId: string, actorRole: string, tableId: string): string {
  return `sofra.table-readiness.${actorId.toLowerCase()}.${actorRole}.${tableId.toLowerCase()}`;
}

export function readPendingTableReadiness(
  actorId: string,
  actorRole: string,
  tableId: string,
): PendingTableReadinessRead {
  if (typeof window === 'undefined') return { status: 'unavailable' };
  try {
    const raw = window.sessionStorage.getItem(key(actorId, actorRole, tableId));
    if (raw === null) return { status: 'none' };
    const parsed = descriptor.safeParse(JSON.parse(raw) as unknown);
    if (
      !parsed.success ||
      parsed.data.actorId.toLowerCase() !== actorId.toLowerCase() ||
      parsed.data.actorRole !== actorRole ||
      parsed.data.tableId.toLowerCase() !== tableId.toLowerCase()
    ) {
      return { status: 'unavailable' };
    }
    return { status: 'pending', value: parsed.data };
  } catch (_error: unknown) {
    // Unreadable storage cannot establish whether an unresolved request already exists.
    return { status: 'unavailable' };
  }
}

/** Preserve the original actor/table/version/key before making a readiness request. */
export function persistPendingTableReadiness(value: PendingTableReadiness): boolean {
  const parsed = descriptor.safeParse(value);
  if (!parsed.success || typeof window === 'undefined') return false;
  const saved = readPendingTableReadiness(value.actorId, value.actorRole, value.tableId);
  if (saved.status === 'unavailable') return false;
  if (saved.status === 'pending' && JSON.stringify(saved.value) !== JSON.stringify(parsed.data)) return false;
  try {
    window.sessionStorage.setItem(key(value.actorId, value.actorRole, value.tableId), JSON.stringify(parsed.data));
    return true;
  } catch (_error: unknown) {
    // A request may be sent only after its original descriptor is durably stored.
    return false;
  }
}

export function clearPendingTableReadiness(value: PendingTableReadiness): boolean {
  const saved = readPendingTableReadiness(value.actorId, value.actorRole, value.tableId);
  if (saved.status === 'none') return true;
  if (saved.status !== 'pending' || JSON.stringify(saved.value) !== JSON.stringify(value)) return false;
  try {
    window.sessionStorage.removeItem(key(value.actorId, value.actorRole, value.tableId));
    return true;
  } catch (_error: unknown) {
    // Keep recovery blocked when removal cannot be confirmed; never assume the journal cleared.
    return false;
  }
}
