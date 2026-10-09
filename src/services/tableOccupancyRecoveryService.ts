import { z } from 'zod';
import { ApiError, apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type { ApiResponse } from '@/types/order';
import type {
  RecoverTableOccupancyRequest,
  TableOccupancyRecoveryOperation,
  TableOccupancyRecoveryPreview,
} from '@/types/tableOccupancyRecovery';

const order = z
  .object({
    orderId: z.string().uuid(),
    orderNumber: z.string(),
    disposition: z.enum(['CancelledUnsent', 'ArchivedLegacyOccupancy', 'RetainedInPriorVisit']),
    originalStatus: z.string(),
    originalPaymentStatus: z.string(),
    originalTotal: z.number().finite(),
    originalBillingCreditAmount: z.number().finite(),
    originalTotalPaid: z.number().finite(),
    originalRemainingAmount: z.number().finite(),
    wasLegacyUnassigned: z.boolean(),
    wasKitchenReleased: z.boolean(),
    hadRoutingHistory: z.boolean(),
  })
  .strict();

const preview = z
  .object({
    tableId: z.string().uuid(),
    tableNumber: z.string(),
    serviceSessionId: z.string().uuid().nullable(),
    sessionVersion: z.number().int().positive().nullable(),
    accountRevision: z.number().int().positive().nullable(),
    readinessVersion: z.number().int().positive(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    previewFingerprint: z.string().regex(/^[A-Fa-f0-9]{64}$/),
    orderCount: z.number().int().nonnegative(),
    cancelableUnsentCount: z.number().int().nonnegative(),
    legacyUnassignedCount: z.number().int().nonnegative(),
    routedOrderCount: z.number().int().nonnegative(),
    preparingOrderCount: z.number().int().nonnegative(),
    readyOrderCount: z.number().int().nonnegative(),
    paidOrRefundedOrderCount: z.number().int().nonnegative(),
    activePaymentAttemptCount: z.number().int().nonnegative(),
    pendingPaymentHandoffCount: z.number().int().nonnegative(),
    checkoutAttemptCount: z.number().int().nonnegative(),
    preservedOutstandingAmount: z.number().finite(),
    orders: z.array(order),
  })
  .strict();

const operation = z
  .object({
    operationId: z.string().uuid(),
    tableId: z.string().uuid(),
    serviceSessionId: z.string().uuid().nullable(),
    reason: z.string(),
    recordedAt: z.string().datetime({ offset: true }),
    visitReleasedAt: z.string().datetime({ offset: true }).nullable(),
    readinessState: z.string(),
    readinessVersion: z.number().int().positive(),
    sessionVersion: z.number().int().positive().nullable(),
    accountRevision: z.number().int().positive().nullable(),
    cancelledUnsentCount: z.number().int().nonnegative(),
    archivedLegacyCount: z.number().int().nonnegative(),
    retainedPriorVisitCount: z.number().int().nonnegative(),
    preservedPaidAmount: z.number().finite(),
    preservedOutstandingAmount: z.number().finite(),
    orders: z.array(order),
  })
  .strict();

const envelope = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  errorCode: z.string().optional(),
  data: z.unknown().optional(),
});

function tablePath(tableId: string): string {
  return `/api/Tables/${encodeURIComponent(tableId)}/occupancy-recovery`;
}

function requireData<T>(value: unknown, schema: z.ZodType<T>): T {
  const response = envelope.parse(value);
  if (response.success !== true) throwServerRefusal(response);
  return schema.parse(response.data);
}

export async function previewTableOccupancyRecovery(
  tableId: string,
  serviceSessionId?: string | null,
): Promise<TableOccupancyRecoveryPreview> {
  const query = serviceSessionId ? `?serviceSessionId=${encodeURIComponent(serviceSessionId)}` : '';
  const response = await apiClient.get<unknown>(`${tablePath(tableId)}${query}`, { requireAuth: true });
  return requireData(response, preview);
}

export async function recoverTableOccupancy(
  tableId: string,
  request: RecoverTableOccupancyRequest,
): Promise<TableOccupancyRecoveryOperation> {
  try {
    const response = await apiClient.post<unknown>(tablePath(tableId), request, { requireAuth: true });
    return requireData(response, operation);
  } catch (error: unknown) {
    rethrowTerminalRefusal(error);
  }
}

/** Read back the same operation after a lost response; this GET never performs recovery. */
export async function getTableOccupancyRecoveryOperation(
  tableId: string,
  operationId: string,
): Promise<TableOccupancyRecoveryOperation | null> {
  const response = envelope.parse(
    await apiClient.get<unknown>(`${tablePath(tableId)}/operations/${encodeURIComponent(operationId)}`, {
      requireAuth: true,
    }),
  );
  if (!response.success && response.errorCode === 'TableOccupancyRecoveryOperationNotFound') return null;
  if (response.success !== true) throwServerRefusal(response);
  return operation.parse(response.data);
}

export function occupancyRecoveryResponseMatches(
  result: TableOccupancyRecoveryOperation,
  tableId: string,
  request: RecoverTableOccupancyRequest,
): boolean {
  return (
    result.tableId.toLowerCase() === tableId.toLowerCase() &&
    result.operationId.toLowerCase() === request.operationId.toLowerCase() &&
    result.serviceSessionId?.toLowerCase() === request.serviceSessionId?.toLowerCase()
  );
}

export function occupancyRecoveryPreviewMatches(
  result: TableOccupancyRecoveryPreview,
  tableId: string,
  serviceSessionId?: string,
): boolean {
  return (
    result.tableId.toLowerCase() === tableId.toLowerCase() &&
    (!serviceSessionId || result.serviceSessionId?.toLowerCase() === serviceSessionId.toLowerCase())
  );
}

export type TableOccupancyRecoveryPreviewResponse = ApiResponse<TableOccupancyRecoveryPreview>;

/** A server-confirmed refusal that is guaranteed to have made no recovery change. */
export class TableOccupancyRecoveryTerminalRefusal extends Error {
  constructor(public readonly code: 'stale_preview' | 'session_ambiguous') {
    super(code);
    this.name = 'TableOccupancyRecoveryTerminalRefusal';
  }
}

function rethrowTerminalRefusal(error: unknown): never {
  if (error instanceof ApiError) {
    if (error.errorCode === 'TableOccupancyRecoveryPreviewStale') {
      throw new TableOccupancyRecoveryTerminalRefusal('stale_preview');
    }
    if (error.errorCode === 'TableServiceSessionAmbiguous') {
      throw new TableOccupancyRecoveryTerminalRefusal('session_ambiguous');
    }
  }
  throw error;
}
