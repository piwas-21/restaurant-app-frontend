'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type { GuestEqualSharePlan, GuestEqualSharePlanRequest } from '@/types/guestAccountPayments';
import type { GuestEqualSharePlanIntent } from '@/types/guestEqualSharePlan';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  findGuestEqualSharePlanIntent,
  removeGuestEqualSharePlanIntent,
  saveGuestEqualSharePlanIntent,
} from '@/services/guestEqualSharePlanStorage';

interface PlanRecoveryOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly recoveryIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly refreshAccount: () => Promise<unknown>;
  readonly onAccountUpdated: () => void;
}

export function useGuestPaymentPlanRecovery(options: PlanRecoveryOptions) {
  const {
    activeIdentity,
    recoveryIdentity,
    newPaymentsEnabled,
    canCreatePayment,
    runExclusive,
    refreshAccount,
    onAccountUpdated,
  } = options;
  const intentRef = useRef<GuestEqualSharePlanIntent | null>(null);
  const onAccountUpdatedRef = useRef(onAccountUpdated);
  onAccountUpdatedRef.current = onAccountUpdated;
  const [pendingIntent, setPendingIntent] = useState<GuestEqualSharePlanIntent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [error, setError] = useState<GuestPaymentErrorKey>('');
  const generation = useRef(0);

  const persistIntent = useCallback((intent: GuestEqualSharePlanIntent) => {
    if (intentRef.current || !saveGuestEqualSharePlanIntent(intent)) {
      setStorageUnavailable(true);
      return false;
    }
    intentRef.current = intent;
    setPendingIntent(intent);
    setStorageUnavailable(false);
    return true;
  }, []);

  const completeIntent = useCallback(
    (intent: GuestEqualSharePlanIntent, plan: GuestEqualSharePlan) => {
      if (!matchesIntent(intent, plan)) {
        setError('load');
        return false;
      }
      if (!removeGuestEqualSharePlanIntent(intent)) {
        setStorageUnavailable(true);
        setError('action');
        return false;
      }
      intentRef.current = null;
      setPendingIntent(null);
      setStorageUnavailable(false);
      setError('');
      void refreshAccount();
      onAccountUpdatedRef.current();
      return true;
    },
    [refreshAccount],
  );

  useEffect(() => {
    const requestGeneration = ++generation.current;
    const isCurrent = () => generation.current === requestGeneration;
    const identity = activeIdentity ?? recoveryIdentity;
    setIsLoading(true);
    setError('');
    if (!identity) {
      intentRef.current = null;
      setPendingIntent(null);
      setStorageUnavailable(false);
      setIsLoading(false);
      return () => {
        generation.current += 1;
      };
    }

    void findGuestEqualSharePlanIntent(identity)
      .then(async (found) => {
        if (!isCurrent()) return;
        if (found.kind === 'unavailable') {
          setStorageUnavailable(true);
          setError('action');
          setIsLoading(false);
          return;
        }
        if (found.kind === 'none') {
          intentRef.current = null;
          setPendingIntent(null);
          setStorageUnavailable(false);
          setIsLoading(false);
          return;
        }
        intentRef.current = found.intent;
        setPendingIntent(found.intent);
        setStorageUnavailable(false);
        if (!activeIdentity || activeIdentity.serviceSessionId !== found.intent.serviceSessionId) {
          setIsLoading(false);
          return;
        }
        try {
          const plan = await guestAccountPaymentService.getEqualSharePlan(activeIdentity, found.intent.operationId);
          if (isCurrent()) completeIntent(found.intent, plan);
        } catch (error) {
          if (isCurrent()) setError(guestPaymentErrorMessage(error, 'load'));
        } finally {
          if (isCurrent()) setIsLoading(false);
        }
      })
      .catch(() => {
        if (!isCurrent()) return;
        setStorageUnavailable(true);
        setError('action');
        setIsLoading(false);
      });
    return () => {
      generation.current += 1;
    };
  }, [activeIdentity, completeIntent, recoveryIdentity]);

  const resolveOriginalPlan = useCallback(
    () =>
      runExclusive(async () => {
        const intent = intentRef.current;
        if (!intent || !activeIdentity || activeIdentity.serviceSessionId !== intent.serviceSessionId) return false;
        setError('');
        try {
          const existing = await guestAccountPaymentService.getEqualSharePlan(activeIdentity, intent.operationId);
          return completeIntent(intent, existing);
        } catch (lookupError) {
          if (!newPaymentsEnabled || !canCreatePayment) {
            setError(guestPaymentErrorMessage(lookupError, 'load'));
            return false;
          }
          try {
            const created = await guestAccountPaymentService.createEqualSharePlan(activeIdentity, planRequest(intent));
            return completeIntent(intent, created);
          } catch (error) {
            setError(guestPaymentErrorMessage(error, 'action'));
            return false;
          }
        }
      }, false),
    [activeIdentity, canCreatePayment, completeIntent, newPaymentsEnabled, runExclusive],
  );

  return {
    intentRef,
    pendingIntent,
    isLoading,
    storageUnavailable,
    isBlocked: isLoading || storageUnavailable || pendingIntent !== null,
    error,
    setError,
    retryAvailable: newPaymentsEnabled && canCreatePayment && activeIdentity !== null,
    persistIntent,
    completeIntent,
    resolveOriginalPlan,
  };
}

function planRequest(intent: GuestEqualSharePlanIntent): GuestEqualSharePlanRequest {
  return {
    operationId: intent.operationId,
    expectedAccountRevision: intent.expectedAccountRevision,
    shareCount: intent.shareCount,
    ...(intent.supersedesPlanId ? { supersedesPlanId: intent.supersedesPlanId } : {}),
  };
}

function matchesIntent(intent: GuestEqualSharePlanIntent, plan: GuestEqualSharePlan): boolean {
  return (
    plan.serviceSessionId === intent.serviceSessionId &&
    plan.operationId === intent.operationId &&
    plan.accountRevision === intent.expectedAccountRevision &&
    plan.shareCount === intent.shareCount
  );
}
