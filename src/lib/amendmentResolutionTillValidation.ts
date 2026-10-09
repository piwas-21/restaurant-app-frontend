import { resolutionTillConfirmationsSchema } from '@/schemas/amendmentResolution.schema';
import {
  compareResolutionPaymentIds,
  sameResolutionIdentity,
  validatePendingResolution,
  validateResolutionResult,
} from '@/lib/amendmentResolutionValidation';
import type {
  AmendmentResolutionResult,
  AmendmentResolutionTillConfirmations,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

/** Only exact server-owned reference proof retires a persisted manual-till retry descriptor. */
export function pendingTillConfirmationsSucceeded(
  pending: PendingAmendmentResolution,
  result: AmendmentResolutionResult,
): boolean {
  const original = validatePendingResolution(pending);
  if (!original.pendingTillConfirmations) return false;
  const verified = validateResolutionResult(result, original);
  return verified.refundLegs
    .filter((leg) => leg.custody === 'ManualTill')
    .every((leg) => {
      const proof = leg.tillConfirmation;
      const expected = original.pendingTillConfirmations?.find((value) =>
        sameResolutionIdentity(value.paymentId, leg.paymentId),
      );
      return (
        leg.state === 'Succeeded' &&
        proof !== null &&
        proof !== undefined &&
        (expected === undefined || expected.tillReference === proof.tillReference)
      );
    });
}

function serverConfirmedTillEvidence(
  original: PendingAmendmentResolution,
  leg: AmendmentResolutionResult['refundLegs'][number],
): AmendmentResolutionTillConfirmations[number] | null {
  const tillConfirmation = leg.tillConfirmation;
  if (!tillConfirmation) return null;
  const paymentId = leg.paymentId.toLowerCase();
  const quoteLeg = original.reviewedQuote.refundLegs.find((value) =>
    sameResolutionIdentity(value.paymentId, paymentId),
  );
  if (!quoteLeg) return null;
  const cashReturnedMinor = quoteLeg.cashRefund ? leg.cashReturn?.cashReturnedMinor : undefined;
  if (quoteLeg.cashRefund && cashReturnedMinor === undefined) return null;
  return {
    paymentId,
    tillReference: tillConfirmation.tillReference,
    ...(cashReturnedMinor !== undefined ? { cashReturnedMinor } : {}),
  };
}

function requestedTillEvidence(
  leg: AmendmentResolutionResult['refundLegs'][number],
  requested: Map<string, AmendmentResolutionTillConfirmations[number]>,
): AmendmentResolutionTillConfirmations[number] | null {
  const confirmation = requested.get(leg.paymentId.toLowerCase());
  return leg.state === 'Pending' && leg.tillConfirmation == null && confirmation ? confirmation : null;
}

function completeManualBatch(
  original: PendingAmendmentResolution,
  manualLegs: AmendmentResolutionResult['refundLegs'],
  requested: Map<string, AmendmentResolutionTillConfirmations[number]>,
): AmendmentResolutionTillConfirmations | null {
  const completeBatch: AmendmentResolutionTillConfirmations = [];
  for (const leg of manualLegs) {
    const confirmation =
      leg.state === 'Succeeded' ? serverConfirmedTillEvidence(original, leg) : requestedTillEvidence(leg, requested);
    if (!confirmation) return null;
    completeBatch.push(confirmation);
  }
  return completeBatch;
}

/** Bind one immutable batch to the currently pending ManualTill legs before their first POST. */
export function preparePendingTillConfirmations(
  pending: PendingAmendmentResolution,
  currentResult: AmendmentResolutionResult,
  input: unknown,
): PendingAmendmentResolution | null {
  const original = validatePendingResolution(pending);
  if (original.pendingTillConfirmations) return null;
  const parsed = resolutionTillConfirmationsSchema.safeParse(input);
  if (!parsed.success) return null;
  const confirmations = parsed.data
    .map((confirmation) => ({ ...confirmation, paymentId: confirmation.paymentId.toLowerCase() }))
    .sort(compareResolutionPaymentIds);
  const result = validateResolutionResult(currentResult, original);
  const manualLegs = result.refundLegs.filter((leg) => leg.custody === 'ManualTill');
  const pendingManualIds = manualLegs
    .filter((leg) => leg.state === 'Pending' && leg.tillConfirmation == null)
    .map((leg) => leg.paymentId.toLowerCase())
    .sort();
  if (
    pendingManualIds.length !== confirmations.length ||
    !pendingManualIds.every((paymentId, index) => paymentId === confirmations[index]?.paymentId)
  )
    return null;
  const requested = new Map(confirmations.map((confirmation) => [confirmation.paymentId, confirmation]));
  const completeBatch = completeManualBatch(original, manualLegs, requested);
  if (!completeBatch) return null;
  return validatePendingResolution({ ...original, pendingTillConfirmations: completeBatch });
}

/** A replay can only resend the saved batch while every ManualTill leg remains compatible with it. */
export function pendingTillConfirmationBatchForRetry(
  pending: PendingAmendmentResolution,
  currentResult: AmendmentResolutionResult,
): AmendmentResolutionTillConfirmations | null {
  const original = validatePendingResolution(pending);
  if (!original.pendingTillConfirmations) return null;
  let result: AmendmentResolutionResult | null = null;
  try {
    result = validateResolutionResult(currentResult, original);
  } catch (_resultError: unknown) {
    // Invalid operation readback never authorizes a retry with the saved physical evidence.
  }
  if (!result) return null;
  const savedIds = new Set(original.pendingTillConfirmations.map((value) => value.paymentId));
  const unresolvedManual = result.refundLegs.filter(
    (leg) => leg.custody === 'ManualTill' && leg.state === 'Pending' && leg.tillConfirmation == null,
  );
  if (unresolvedManual.some((leg) => !savedIds.has(leg.paymentId.toLowerCase()))) return null;
  const eachSavedCompatible = original.pendingTillConfirmations.every((confirmation) => {
    const leg = result.refundLegs.find((value) => sameResolutionIdentity(value.paymentId, confirmation.paymentId));
    return (
      leg !== undefined &&
      leg.custody === 'ManualTill' &&
      ((leg.state === 'Pending' && leg.tillConfirmation == null) ||
        (leg.state === 'Succeeded' && leg.tillConfirmation?.tillReference === confirmation.tillReference))
    );
  });
  return eachSavedCompatible ? original.pendingTillConfirmations : null;
}
