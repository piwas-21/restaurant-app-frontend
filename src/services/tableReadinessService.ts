import { z } from 'zod';
import { apiClient } from '@/utils/apiClient';
import type { TableReadinessRequest, TableReadinessResult } from '@/types/tableReadiness';

const envelope = z.object({ success: z.boolean(), errorCode: z.string().optional(), data: z.unknown().optional() });
const outcome = z.object({
  tableId: z.string().uuid(),
  operationId: z.string().uuid(),
  readinessState: z.literal('ReadyForGuests'),
  readinessVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
const RECORDED_REFUSALS = new Set([
  'TableServiceTableInactive',
  'TableReadinessVersionStale',
  'TableReadinessVisitOpen',
  'TableServiceSessionAmbiguous',
  'TableReadinessNotAvailable',
]);

function endpoint(tableId: string): string {
  return `/api/Tables/${encodeURIComponent(tableId)}/ready`;
}

function requireResult(body: unknown, tableId: string, request: TableReadinessRequest): TableReadinessResult {
  const response = envelope.parse(body);
  if (!response.success) {
    const code = response.errorCode ?? 'unknown';
    return { kind: 'refused', code, terminal: RECORDED_REFUSALS.has(code) };
  }
  const result = outcome.parse(response.data);
  if (
    result.tableId.toLowerCase() !== tableId.toLowerCase() ||
    result.operationId.toLowerCase() !== request.operationId.toLowerCase() ||
    result.readinessVersion !== request.expectedReadinessVersion + 1
  ) {
    throw new Error('TableReadinessIdentityMismatch');
  }
  return { kind: 'succeeded', outcome: result };
}

export async function markTableReady(tableId: string, request: TableReadinessRequest): Promise<TableReadinessResult> {
  const response = await apiClient.post<unknown>(endpoint(tableId), request, {
    requireAuth: true,
    signOutOn401: false,
  });
  return requireResult(response, tableId, request);
}

/** Read the original staff-owned outcome without changing table state. */
export async function lookupTableReadiness(
  tableId: string,
  request: TableReadinessRequest,
): Promise<TableReadinessResult> {
  const response = await apiClient.get<unknown>(
    `${endpoint(tableId)}/operations/${encodeURIComponent(request.operationId)}`,
    {
      requireAuth: true,
      signOutOn401: false,
    },
  );
  return requireResult(response, tableId, request);
}
