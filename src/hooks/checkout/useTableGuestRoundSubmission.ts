'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import { basketService } from '@/services/basketService';
import type { BasketDto } from '@/types/basket';
import { ApiError } from '@/utils/apiClient';
import type { PendingTableGuestRound } from '@/types/tableGuestVisit';
import { useTableGuestDineInAvailability } from './useTableGuestDineInAvailability';

interface TableGuestRoundSubmissionOptions {
  readonly basket: BasketDto | null;
  readonly itemCount: number;
  readonly syncBasket: () => Promise<boolean>;
  readonly clearCart: () => Promise<void>;
}

export function useTableGuestRoundSubmission({
  basket,
  itemCount,
  syncBasket,
  clearCart,
}: TableGuestRoundSubmissionOptions) {
  const { t } = useTranslation();
  const visitContext = useTableGuestVisit();
  const dineInAvailability = useTableGuestDineInAvailability();
  const refreshDineInAvailability = dineInAvailability.refreshDineInAvailability;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submissionLock = useRef(false);

  const submit = useCallback(async () => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const attempt = await prepareTableGuestRoundAttempt({
        visitContext,
        basket,
        itemCount,
        syncBasket,
        refreshDineInAvailability,
        setError,
        translate: t,
      });
      if (!attempt) return;

      await visitContext.createRound({
        operationId: attempt.operationId,
        expectedAccountRevision: attempt.expectedAccountRevision,
        expectedBasketFingerprint: attempt.expectedBasketFingerprint,
      });
      await finishCommittedRound(attempt, clearCart, syncBasket);
      visitContext.clearPendingRound();
      visitContext.recordRoundAcknowledgement();
    } catch (requestError) {
      if (isStaleTableVisitError(requestError)) {
        visitContext.clearPendingRound();
        await Promise.allSettled([visitContext.getAccount(), syncBasket()]);
        setError(t('table_guest_round_stale'));
      } else if (isOrderTypeUnavailableError(requestError)) {
        // Availability can change after the preflight read but before the server accepts the
        // round. Refresh every consumer and keep the exact descriptor so an uncertain retry cannot
        // create a second operation.
        await refreshDineInAvailability();
        setError(t('table_guest_dine_in_unavailable'));
      } else {
        // A lost response is uncertain: keep its descriptor so the next click resends the same operation.
        setError(t('table_guest_round_submit_failed'));
      }
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }, [basket, clearCart, itemCount, refreshDineInAvailability, syncBasket, t, visitContext]);

  return {
    submit,
    isSubmitting,
    error,
    pendingRound: visitContext.pendingRound,
    pendingRoundUnavailable: visitContext.pendingRoundStatus === 'unknown',
    lastRoundAcknowledgement: visitContext.lastRoundAcknowledgement,
    dineInUnavailable: dineInAvailability.dineInUnavailable && visitContext.pendingRound === null,
    refreshDineInAvailability: dineInAvailability.refreshDineInAvailability,
    canSubmit:
      visitContext.phase === 'active' &&
      visitContext.pendingRoundStatus !== 'unknown' &&
      (visitContext.pendingRound !== null || (itemCount > 0 && dineInAvailability.dineInAvailable)),
  };
}

interface PrepareTableGuestRoundAttemptOptions {
  readonly visitContext: ReturnType<typeof useTableGuestVisit>;
  readonly basket: BasketDto | null;
  readonly itemCount: number;
  readonly syncBasket: () => Promise<boolean>;
  readonly refreshDineInAvailability: () => Promise<boolean>;
  readonly setError: (value: string) => void;
  readonly translate: (key: string) => string;
}

async function prepareTableGuestRoundAttempt({
  visitContext,
  basket,
  itemCount,
  syncBasket,
  refreshDineInAvailability,
  setError,
  translate,
}: PrepareTableGuestRoundAttemptOptions): Promise<PendingTableGuestRound | null> {
  const identity = visitContext.visit;
  if (visitContext.phase !== 'active' || !identity) throw new Error('Visit unavailable');
  if (visitContext.pendingRoundStatus === 'unknown') {
    setError(translate('table_guest_storage_help'));
    return null;
  }

  let attempt = visitContext.pendingRound;
  if (attempt && attempt.serviceSessionId !== identity.serviceSessionId) {
    setError(translate('table_guest_storage_help'));
    return null;
  }
  if (attempt) return attempt;
  if (itemCount === 0) throw new Error('An empty basket cannot start a table round.');
  if (!(await refreshDineInAvailability())) {
    setError(translate('table_guest_dine_in_unavailable'));
    return null;
  }

  const account = await visitContext.getAccount();
  const freshBasket = await basketService.getBasket();
  const reviewedFingerprint = basket?.purchaseFingerprint;
  if (!isFingerprint(reviewedFingerprint) || !isFingerprint(freshBasket?.purchaseFingerprint)) {
    await syncBasket();
    setError(translate('table_guest_fingerprint_unavailable'));
    return null;
  }
  if (freshBasket.purchaseFingerprint.toUpperCase() !== reviewedFingerprint.toUpperCase()) {
    await syncBasket();
    setError(translate('table_guest_round_stale'));
    return null;
  }
  if (freshBasket.items.length === 0 || !Number.isSafeInteger(account.accountRevision) || account.accountRevision < 1) {
    await syncBasket();
    setError(translate('table_guest_round_stale'));
    return null;
  }

  const operationId = createOperationId();
  if (!operationId) throw new Error('Secure operation IDs are unavailable.');
  attempt = {
    serviceSessionId: identity.serviceSessionId,
    operationId,
    expectedAccountRevision: account.accountRevision,
    expectedBasketFingerprint: reviewedFingerprint.toUpperCase(),
  };
  if (!visitContext.savePendingRound(attempt)) {
    setError(translate('table_guest_storage_help'));
    return null;
  }
  return attempt;
}

async function finishCommittedRound(
  attempt: PendingTableGuestRound,
  clearCart: () => Promise<void>,
  syncBasket: () => Promise<boolean>,
): Promise<void> {
  const currentBasket = await basketService.getBasket();
  if (
    currentBasket?.items.length &&
    currentBasket.purchaseFingerprint?.toUpperCase() === attempt.expectedBasketFingerprint
  ) {
    await clearCart();
    return;
  }
  if (!(await syncBasket())) throw new Error('The committed round could not be reconciled with the basket.');
}

function isFingerprint(value: string | undefined): value is string {
  return typeof value === 'string' && /^[A-F0-9]{64}$/i.test(value);
}

function createOperationId(): string | null {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return null;
  return crypto.randomUUID();
}

function isStaleTableVisitError(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'TableServiceSessionStale';
}

function isOrderTypeUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'OrderTypeNotAvailable';
}
