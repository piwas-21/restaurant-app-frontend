import { z } from 'zod';
import { apiClient } from '@/utils/apiClient';
import {
  validatePendingResolution,
  validateResolutionQuote,
  validateResolutionResult,
} from '@/lib/amendmentResolutionValidation';
import { validateResolutionOutcome } from '@/lib/amendmentResolutionOutcomeValidation';
import {
  resolutionQuoteRequestSchema,
  resolutionTillConfirmationRequestSchema,
} from '@/schemas/amendmentResolution.schema';
import type {
  AmendmentResolutionOutcome,
  AmendmentResolutionQuoteRequest,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

const envelope = z.object({ success: z.boolean(), data: z.unknown().optional() });
const authenticated = { requireAuth: true, signOutOn401: false } as const;

function endpoint(orderId: string, amendmentId: string): string {
  return `/api/staff/orders/${encodeURIComponent(orderId)}/amendments/${encodeURIComponent(amendmentId)}/financial-resolution`;
}

function data(body: unknown): unknown {
  const response = envelope.parse(body);
  if (!response.success) throw new Error('AmendmentResolutionUnavailable');
  return response.data;
}

export async function quoteAmendmentResolution(
  orderId: string,
  amendmentId: string,
  request: AmendmentResolutionQuoteRequest,
) {
  const original = resolutionQuoteRequestSchema.parse(request);
  const body = await apiClient.post<unknown>(`${endpoint(orderId, amendmentId)}/quote`, original, authenticated);
  return validateResolutionQuote(data(body), orderId, amendmentId, original);
}

export async function startAmendmentResolution(
  pending: PendingAmendmentResolution,
): Promise<AmendmentResolutionOutcome> {
  const original = validatePendingResolution(pending);
  const body = await apiClient.post<unknown>(
    endpoint(original.orderId, original.amendmentId),
    original.request,
    authenticated,
  );
  return validateResolutionOutcome(data(body), original);
}

/** Original client key remains usable when Start's response was lost or writes are disabled. */
export async function lookupAmendmentResolution(
  pending: PendingAmendmentResolution,
): Promise<AmendmentResolutionOutcome> {
  const original = validatePendingResolution(pending);
  const body = await apiClient.get<unknown>(
    `${endpoint(original.orderId, original.amendmentId)}/operations/${encodeURIComponent(original.request.quote.clientOperationId)}`,
    authenticated,
  );
  return validateResolutionOutcome(data(body), original);
}

/** Explicit recovery may contact the provider; it requires a previously verified operation identity. */
export async function recoverAmendmentResolution(pending: PendingAmendmentResolution) {
  const original = validatePendingResolution(pending);
  if (!original.operationId) return startAmendmentResolution(original);
  const body = await apiClient.post<unknown>(
    `/api/staff/amendment-financial-resolution-operations/${encodeURIComponent(original.operationId)}/recover`,
    {},
    authenticated,
  );
  return {
    outcome: 'accepted' as const,
    result: validateResolutionResult(data(body), original),
  };
}

/** Confirm one physically returned manual leg only from its already-persisted exact retry batch. */
export async function confirmAmendmentResolutionTill(pending: PendingAmendmentResolution, input: unknown) {
  const original = validatePendingResolution(pending);
  if (!original.operationId || !original.pendingTillConfirmations)
    throw new Error('AmendmentResolutionTillEvidenceUnavailable');
  const confirmation = resolutionTillConfirmationRequestSchema.parse(input);
  const saved = original.pendingTillConfirmations.find(
    (value) => value.paymentId.toLowerCase() === confirmation.paymentId.toLowerCase(),
  );
  const inputHasCashReturn = Object.prototype.hasOwnProperty.call(confirmation, 'cashReturnedMinor');
  const savedHasCashReturn = saved !== undefined && Object.prototype.hasOwnProperty.call(saved, 'cashReturnedMinor');
  if (
    !saved ||
    saved.tillReference !== confirmation.tillReference ||
    inputHasCashReturn !== savedHasCashReturn ||
    (inputHasCashReturn && confirmation.cashReturnedMinor !== saved.cashReturnedMinor)
  )
    throw new Error('AmendmentResolutionTillEvidenceMismatch');
  const body = await apiClient.post<unknown>(
    `/api/staff/amendment-financial-resolution-operations/${encodeURIComponent(original.operationId)}/confirm-till`,
    confirmation,
    authenticated,
  );
  return validateResolutionResult(data(body), original);
}
