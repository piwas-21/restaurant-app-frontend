import {
  pendingResolutionSchema,
  resolutionQuoteSchema,
  resolutionStartRequestSchema,
  resolutionResultSchema,
} from '@/schemas/amendmentResolution.schema';
import type {
  AmendmentResolutionQuote,
  AmendmentResolutionQuoteRequest,
  AmendmentResolutionResult,
  PendingAmendmentResolution,
  AmendmentResolutionStartRequest,
} from '@/types/amendmentResolution';

export function sameResolutionIdentity(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}
const sameIdentity = sameResolutionIdentity;

function requireMatch(matches: boolean): void {
  if (!matches) throw new Error('AmendmentResolutionEvidenceMismatch');
}

function sum(values: readonly number[]): bigint {
  return values.reduce((total, value) => total + BigInt(value), BigInt(0));
}

export function compareResolutionIdentities(first: string, second: string): number {
  const firstId = first.toLowerCase();
  const secondId = second.toLowerCase();
  if (firstId === secondId) return 0;
  return firstId < secondId ? -1 : 1;
}

export function compareResolutionPaymentIds(first: { paymentId: string }, second: { paymentId: string }): number {
  return compareResolutionIdentities(first.paymentId, second.paymentId);
}
const comparePaymentIds = compareResolutionPaymentIds;

/** Mirrors backend request canonicalization for refusal matching; the server hash stays opaque. */
export function canonicalResolutionStartRequest(
  input: AmendmentResolutionStartRequest,
): AmendmentResolutionStartRequest {
  const request = resolutionStartRequestSchema.parse(input);
  return {
    quote: {
      ...request.quote,
      clientOperationId: request.quote.clientOperationId.toLowerCase(),
      expectedAccountRevision: request.quote.expectedAccountRevision ?? null,
      manualRefunds: request.quote.manualRefunds
        .map((selection) => ({ ...selection, paymentId: selection.paymentId.toLowerCase() }))
        .sort(comparePaymentIds),
    },
    quoteHash: request.quoteHash,
    expiresAt: request.expiresAt,
  };
}

function validateConservation(value: AmendmentResolutionQuote | AmendmentResolutionResult): void {
  requireMatch(BigInt(value.creditMinor) === BigInt(value.refundMinor) + BigInt(value.unpaidWaivedMinor));
  requireMatch(sum(value.refundLegs.map((leg) => leg.amountMinor)) === BigInt(value.refundMinor));
  requireMatch(new Set(value.refundLegs.map((leg) => leg.paymentId.toLowerCase())).size === value.refundLegs.length);
}

export function validateResolutionQuote(
  body: unknown,
  orderId: string,
  amendmentId: string,
  request: AmendmentResolutionQuoteRequest,
): AmendmentResolutionQuote {
  const quote = resolutionQuoteSchema.parse(body);
  requireMatch(sameIdentity(quote.orderId, orderId) && sameIdentity(quote.amendmentId, amendmentId));
  requireMatch(sameIdentity(quote.clientOperationId, request.clientOperationId) && quote.currency === request.currency);
  validateConservation(quote);
  for (const leg of quote.refundLegs) {
    const manual = leg.custody === 'ManualTill';
    requireMatch(leg.requiresTillConfirmation === manual);
    requireMatch(manual ? leg.paymentMethod !== 'OnlinePayment' : leg.paymentMethod === 'OnlinePayment');
    for (const scope of leg.scopes) {
      requireMatch(BigInt(scope.amountMinor) === BigInt(scope.minorPerUnit) * BigInt(scope.unitCount));
      requireMatch(BigInt(scope.startOrdinal) + BigInt(scope.unitCount) - BigInt(1) <= BigInt(2_147_483_647));
    }
    if (leg.scopes.length > 0)
      requireMatch(sum(leg.scopes.map((scope) => scope.amountMinor)) === BigInt(leg.amountMinor));
    if (!manual) requireMatch(leg.scopes.length > 0);
    if (leg.scopes.length === 0) {
      const selected = request.manualRefunds.find((value) => sameIdentity(value.paymentId, leg.paymentId));
      requireMatch(selected !== undefined && selected.amountMinor === leg.amountMinor);
    }
  }
  requireMatch(
    new Set(request.manualRefunds.map((value) => value.paymentId.toLowerCase())).size === request.manualRefunds.length,
  );
  for (const selected of request.manualRefunds) {
    requireMatch(
      quote.refundLegs.some(
        (leg) =>
          sameIdentity(leg.paymentId, selected.paymentId) &&
          leg.custody === 'ManualTill' &&
          leg.scopes.length === 0 &&
          leg.amountMinor === selected.amountMinor,
      ),
    );
  }
  return quote;
}

export function validatePendingResolution(pending: PendingAmendmentResolution): PendingAmendmentResolution {
  const parsed = pendingResolutionSchema.parse(pending);
  const request = canonicalResolutionStartRequest(parsed.request);
  const quote = validateResolutionQuote(parsed.reviewedQuote, parsed.orderId, parsed.amendmentId, request.quote);
  requireMatch(request.quoteHash === quote.quoteHash && request.expiresAt === quote.expiresAt);
  const pendingTillConfirmations = parsed.pendingTillConfirmations
    ?.map((confirmation) => ({
      ...confirmation,
      paymentId: confirmation.paymentId.toLowerCase(),
    }))
    .sort(comparePaymentIds);
  if (pendingTillConfirmations) {
    requireMatch(parsed.operationId !== null);
    requireMatch(
      new Set(pendingTillConfirmations.map((value) => value.paymentId)).size === pendingTillConfirmations.length,
    );
    const manualPaymentIds = new Set(
      quote.refundLegs.filter((leg) => leg.custody === 'ManualTill').map((leg) => leg.paymentId.toLowerCase()),
    );
    requireMatch(pendingTillConfirmations.length === manualPaymentIds.size);
    requireMatch(pendingTillConfirmations.every((value) => manualPaymentIds.has(value.paymentId)));
  }
  return {
    ...parsed,
    actorId: parsed.actorId.toLowerCase(),
    orderId: parsed.orderId.toLowerCase(),
    amendmentId: parsed.amendmentId.toLowerCase(),
    operationId: parsed.operationId?.toLowerCase() ?? null,
    request,
    reviewedQuote: quote,
    ...(pendingTillConfirmations ? { pendingTillConfirmations } : {}),
  };
}

function validateResultIdentity(result: AmendmentResolutionResult, original: PendingAmendmentResolution): void {
  const quote = original.reviewedQuote;
  requireMatch(
    sameIdentity(result.sourceOrderId, original.orderId) && sameIdentity(result.amendmentId, original.amendmentId),
  );
  requireMatch(sameIdentity(result.clientOperationId, original.request.quote.clientOperationId));
  if (original.operationId) requireMatch(sameIdentity(result.operationId, original.operationId));
  requireMatch(result.currency === quote.currency && result.creditMinor === quote.creditMinor);
  requireMatch(result.refundMinor === quote.refundMinor && result.unpaidWaivedMinor === quote.unpaidWaivedMinor);
}

function validateResultLeg(
  leg: AmendmentResolutionResult['refundLegs'][number],
  original: PendingAmendmentResolution,
): void {
  const quoteLeg = original.reviewedQuote.refundLegs.find((value) => sameIdentity(value.paymentId, leg.paymentId));
  requireMatch(quoteLeg !== undefined && quoteLeg.custody === leg.custody && quoteLeg.amountMinor === leg.amountMinor);
  requireMatch(leg.state === 'Succeeded' ? leg.resolvedAt !== null : leg.resolvedAt === null);
  const tillConfirmation = leg.tillConfirmation ?? null;
  if (leg.custody === 'ManualTill') {
    if (leg.state === 'Succeeded') {
      requireMatch(tillConfirmation !== null && leg.resolvedAt !== null);
      if (tillConfirmation && leg.resolvedAt)
        requireMatch(Date.parse(tillConfirmation.confirmedAt) === Date.parse(leg.resolvedAt));
    } else requireMatch(tillConfirmation === null);
  } else requireMatch(tillConfirmation === null);
  const expected = original.pendingTillConfirmations?.find((value) => sameIdentity(value.paymentId, leg.paymentId));
  if (expected && tillConfirmation) requireMatch(expected.tillReference === tillConfirmation.tillReference);
}

function validateResultLegs(result: AmendmentResolutionResult, original: PendingAmendmentResolution): void {
  requireMatch(result.refundLegs.length === original.reviewedQuote.refundLegs.length);
  for (const leg of result.refundLegs) validateResultLeg(leg, original);
  requireMatch(result.state === 'Resolved' ? result.resolvedAt !== null : result.resolvedAt === null);
  if (result.state === 'Resolved') requireMatch(result.refundLegs.every((leg) => leg.state === 'Succeeded'));
}

/** Unknown or mismatched money must never retire an original refund request. */
export function validateResolutionResult(
  body: unknown,
  pending: PendingAmendmentResolution,
): AmendmentResolutionResult {
  const original = validatePendingResolution(pending);
  const result = resolutionResultSchema.parse(body);
  validateResultIdentity(result, original);
  validateConservation(result);
  validateResultLegs(result, original);
  return result;
}
