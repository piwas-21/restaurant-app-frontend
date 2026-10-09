import { z } from 'zod';
import { apiClient } from '@/utils/apiClient';
import {
  amendmentResolutionRecoverySchema,
  amendmentResolutionRecoveryListSchema,
} from '@/schemas/amendmentResolutionRecovery.schema';
import { validatePendingResolution, validateResolutionResult } from '@/lib/amendmentResolutionValidation';
import type { AmendmentResolutionResult, PendingAmendmentResolution } from '@/types/amendmentResolution';

export interface AmendmentResolutionRecovery {
  readonly pending: PendingAmendmentResolution;
  readonly result: AmendmentResolutionResult;
}
const envelope = z.object({ success: z.literal(true), data: z.unknown() });
const authenticated = { requireAuth: true, signOutOn401: false } as const;

function validate(body: unknown, actorId: string, orderId: string, amendmentId?: string): AmendmentResolutionRecovery {
  const parsed = amendmentResolutionRecoverySchema.parse(body);
  const pending = validatePendingResolution({
    actorId,
    orderId,
    amendmentId: amendmentId ?? parsed.reviewedQuote.amendmentId,
    request: parsed.originalRequest,
    reviewedQuote: parsed.reviewedQuote,
    operationId: parsed.result.operationId,
  });
  return { pending, result: validateResolutionResult(parsed.result, pending) };
}

/** Authenticated readback only: does not start or retry a refund, even with writes disabled. */
export async function getAmendmentResolutionRecovery(actorId: string, orderId: string, amendmentId: string) {
  const body = await apiClient.get<unknown>(
    `/api/staff/orders/${encodeURIComponent(orderId)}/amendments/${encodeURIComponent(amendmentId)}/financial-resolution/recovery`,
    authenticated,
  );
  return validate(envelope.parse(body).data, actorId, orderId, amendmentId);
}

/** Only unresolved operations owned by the authenticated Admin; an error cannot prove an empty inventory. */
export async function listAmendmentResolutionRecovery(
  actorId: string,
  orderId: string,
): Promise<readonly AmendmentResolutionRecovery[]> {
  const body = await apiClient.get<unknown>(
    `/api/staff/orders/${encodeURIComponent(orderId)}/amendment-financial-resolution-recovery`,
    authenticated,
  );
  const list = amendmentResolutionRecoveryListSchema.parse(envelope.parse(body).data);
  const values = list.map((value) => validate(value, actorId, orderId));
  if (values.some((value) => value.result.state === 'Resolved')) throw new Error('resolution-recovery-mismatch');
  return values;
}
