import { resolutionOutcomeSchema, resolutionRefusalSchema } from '@/schemas/amendmentResolution.schema';
import type {
  AmendmentResolutionOutcome,
  AmendmentResolutionRefusal,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';
import {
  canonicalResolutionStartRequest,
  validatePendingResolution,
  validateResolutionResult,
} from './amendmentResolutionValidation';

function sameIdentity(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function requireMatch(matches: boolean): void {
  if (!matches) throw new Error('AmendmentResolutionEvidenceMismatch');
}

/** Accept only a durable pre-provider refusal bound to this actor and exact original request. */
export function validateResolutionRefusal(
  body: unknown,
  pending: PendingAmendmentResolution,
): AmendmentResolutionRefusal {
  const original = validatePendingResolution(pending);
  const refusal = resolutionRefusalSchema.parse(body);
  requireMatch(original.operationId === null);
  requireMatch(
    sameIdentity(refusal.actorUserId, original.actorId) &&
      sameIdentity(refusal.orderId, original.orderId) &&
      sameIdentity(refusal.amendmentId, original.amendmentId) &&
      sameIdentity(refusal.clientOperationId, original.request.quote.clientOperationId),
  );
  requireMatch(
    JSON.stringify(canonicalResolutionStartRequest(refusal.originalRequest)) === JSON.stringify(original.request),
  );
  return {
    ...refusal,
    actorUserId: refusal.actorUserId.toLowerCase(),
    orderId: refusal.orderId.toLowerCase(),
    amendmentId: refusal.amendmentId.toLowerCase(),
    clientOperationId: refusal.clientOperationId.toLowerCase(),
    originalRequest: canonicalResolutionStartRequest(refusal.originalRequest),
  };
}

export function validateResolutionOutcome(
  body: unknown,
  pending: PendingAmendmentResolution,
): AmendmentResolutionOutcome {
  const outcome = resolutionOutcomeSchema.parse(body);
  if (outcome.outcome === 'accepted') {
    const accepted: AmendmentResolutionOutcome = {
      outcome: 'accepted',
      result: validateResolutionResult(outcome.result, pending),
    };
    return outcome.refusal === null ? { ...accepted, refusal: null } : accepted;
  }
  const refused: AmendmentResolutionOutcome = {
    outcome: 'refused',
    refusal: validateResolutionRefusal(outcome.refusal, pending),
  };
  return outcome.result === null ? { ...refused, result: null } : refused;
}
