'use client';

import { useCallback } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountPaymentAccount,
  GuestEqualSharePlan,
  GuestPaymentEqualShareSummary,
} from '@/types/guestAccountPayments';
import type { GuestAccountPaymentAttemptDescriptor } from '@/types/guestAccountPayments';
import type { GuestEqualSharePlanIntent } from '@/types/guestEqualSharePlan';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { canCreateGuestEqualSharePlan, createPaymentOperationId } from '@/lib/guestAccountPaymentRules';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import { createGuestEqualSharePlanIntent } from '@/services/guestEqualSharePlanStorage';

interface EqualShareActionOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly account: GuestAccountPaymentAccount | null;
  readonly activePlan: GuestPaymentEqualShareSummary | null;
  readonly canReplaceAttempt: boolean;
  readonly isPlanRecoveryBlocked: boolean;
  readonly planIntentRef: { current: GuestEqualSharePlanIntent | null };
  readonly persistIntent: (intent: GuestEqualSharePlanIntent) => boolean;
  readonly completeIntent: (intent: GuestEqualSharePlanIntent, plan: GuestEqualSharePlan) => boolean;
  readonly setPlanError: (error: string) => void;
  readonly descriptorRef: { current: GuestAccountPaymentAttemptDescriptor | null };
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly refreshAccount: () => Promise<GuestAccountPaymentAccount | null>;
  readonly setError: (error: string) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
}

export function useGuestPaymentEqualSharePlanAction(options: EqualShareActionOptions) {
  return useCallback(
    async (shareCount: number) => {
      const {
        activeIdentity,
        newPaymentsEnabled,
        canCreatePayment,
        account,
        activePlan,
        canReplaceAttempt,
        isPlanRecoveryBlocked,
        planIntentRef,
        persistIntent,
        completeIntent,
        setPlanError,
        descriptorRef,
        runExclusive,
        refreshAccount,
        setError,
        setStorageUnavailable,
      } = options;
      if (
        !newPaymentsEnabled ||
        !canCreatePayment ||
        !activeIdentity ||
        !account ||
        isPlanRecoveryBlocked ||
        planIntentRef.current !== null ||
        (descriptorRef.current !== null && !canReplaceAttempt) ||
        (activePlan && !activePlan.isOwnPlan) ||
        !canCreateGuestEqualSharePlan(account, shareCount)
      )
        return false;
      return runExclusive(async () => {
        setError('');
        const operationId = createPaymentOperationId();
        if (!operationId) return false;
        try {
          const intent = await createGuestEqualSharePlanIntent(
            activeIdentity,
            operationId,
            account.accountRevision,
            shareCount,
            activePlan?.isOwnPlan ? activePlan.planId : null,
          );
          if (!intent || !persistIntent(intent)) {
            setStorageUnavailable(true);
            throw new Error('storage');
          }
          const plan = await guestAccountPaymentService.createEqualSharePlan(activeIdentity, {
            operationId: intent.operationId,
            expectedAccountRevision: intent.expectedAccountRevision,
            shareCount: intent.shareCount,
            ...(intent.supersedesPlanId ? { supersedesPlanId: intent.supersedesPlanId } : {}),
          });
          return completeIntent(intent, plan);
        } catch (error) {
          setPlanError(guestPaymentErrorMessage(error, 'action'));
          await refreshAccount().catch(() => null);
          return false;
        }
      }, false);
    },
    [options],
  );
}
