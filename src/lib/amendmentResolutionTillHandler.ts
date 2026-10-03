import {
  pendingTillConfirmationBatchForRetry,
  preparePendingTillConfirmations,
} from '@/lib/amendmentResolutionTillValidation';
import { persistPendingTillConfirmations } from '@/lib/pendingAmendmentResolution';
import { confirmAmendmentResolutionTill } from '@/services/amendmentResolutionService';
import type {
  AmendmentResolutionResult,
  AmendmentResolutionTillConfirmations,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

export interface TillBatchResult {
  readonly pending: PendingAmendmentResolution;
  readonly result: AmendmentResolutionResult;
}

/** Freeze the full operator batch before posting any confirmation, then replay only those exact references. */
export async function submitTillConfirmationBatch(
  original: PendingAmendmentResolution,
  currentResult: AmendmentResolutionResult,
  input?: unknown,
): Promise<TillBatchResult | null> {
  let confirmations: AmendmentResolutionTillConfirmations | null = null;
  let pending: PendingAmendmentResolution | null = null;
  try {
    if (original.pendingTillConfirmations) {
      confirmations = pendingTillConfirmationBatchForRetry(original, currentResult);
      pending = original;
    } else {
      pending = preparePendingTillConfirmations(original, currentResult, input);
      confirmations = pending?.pendingTillConfirmations ?? null;
    }
  } catch (_validationError: unknown) {
    // Invalid local or current-operation evidence fails closed before any confirmation POST.
  }
  if (!confirmations) return null;

  if (!pending) return null;
  if (!original.pendingTillConfirmations && !persistPendingTillConfirmations(original, confirmations)) return null;

  let result = currentResult;
  try {
    for (const confirmation of confirmations) {
      result = await confirmAmendmentResolutionTill(pending, confirmation);
    }
  } catch (_confirmationError: unknown) {
    // A lost response keeps the complete saved batch for an exact idempotent retry.
  }
  return { pending, result };
}
