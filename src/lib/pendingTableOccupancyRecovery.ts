import { z } from 'zod';
import type { PendingTableOccupancyRecovery } from '@/types/tableOccupancyRecovery';

const request = z
  .object({
    operationId: z.string().uuid(),
    serviceSessionId: z.string().uuid().nullable(),
    expectedReadinessVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    expectedSessionVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    expectedAccountRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    previewFingerprint: z.string().regex(/^[A-Fa-f0-9]{64}$/),
    confirmRecovery: z.literal(true),
    reason: z.string().min(1).max(500),
  })
  .strict();
const descriptor = z
  .object({
    actorId: z.string().uuid(),
    actorRole: z.enum(['Admin', 'Cashier', 'Server']),
    tableId: z.string().uuid(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    request,
  })
  .strict();

export type PendingTableOccupancyRecoveryRead =
  | { readonly status: 'none' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'role_mismatch' }
  | { readonly status: 'pending'; readonly value: PendingTableOccupancyRecovery };

function key(actorId: string, tableId: string): string {
  return `sofra.table-occupancy-recovery.${actorId.toLowerCase()}.${tableId.toLowerCase()}`;
}

export function readPendingTableOccupancyRecovery(
  actorId: string,
  tableId: string,
  actorRole?: PendingTableOccupancyRecovery['actorRole'],
): PendingTableOccupancyRecoveryRead {
  if (typeof window === 'undefined') return { status: 'unavailable' };
  try {
    const raw = window.sessionStorage.getItem(key(actorId, tableId));
    if (raw === null) return { status: 'none' };
    const parsed = descriptor.safeParse(JSON.parse(raw) as unknown);
    if (
      !parsed.success ||
      parsed.data.actorId.toLowerCase() !== actorId.toLowerCase() ||
      parsed.data.tableId.toLowerCase() !== tableId.toLowerCase()
    )
      return { status: 'unavailable' };
    if (actorRole && parsed.data.actorRole !== actorRole) return { status: 'role_mismatch' };
    return { status: 'pending', value: parsed.data };
  } catch (_error: unknown) {
    // Storage failure cannot be treated as proof that an earlier recovery did not run.
  }
  return { status: 'unavailable' };
}

export function persistPendingTableOccupancyRecovery(value: PendingTableOccupancyRecovery): boolean {
  const parsed = descriptor.safeParse(value);
  if (!parsed.success) return false;
  const saved = readPendingTableOccupancyRecovery(value.actorId, value.tableId);
  if (saved.status === 'unavailable') return false;
  if (saved.status === 'pending' && JSON.stringify(saved.value) !== JSON.stringify(parsed.data)) return false;
  try {
    window.sessionStorage.setItem(key(value.actorId, value.tableId), JSON.stringify(parsed.data));
    return true;
  } catch (_error: unknown) {
    // The request may be sent only after its original operation descriptor is stored.
  }
  return false;
}

export function clearPendingTableOccupancyRecovery(value: PendingTableOccupancyRecovery): boolean {
  const saved = readPendingTableOccupancyRecovery(value.actorId, value.tableId);
  if (saved.status === 'none') return true;
  if (saved.status !== 'pending' || JSON.stringify(saved.value) !== JSON.stringify(value)) return false;
  try {
    window.sessionStorage.removeItem(key(value.actorId, value.tableId));
    return true;
  } catch (_error: unknown) {
    // Keep the original id available for authoritative readback after storage errors.
  }
  return false;
}
