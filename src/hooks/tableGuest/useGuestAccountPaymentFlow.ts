'use client';

import { useCallback, useRef, useState } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
} from '@/types/guestAccountPayments';
import { isTerminalGuestPayment } from '@/lib/guestAccountPaymentRules';
import { useGuestPaymentCheckoutActions } from './useGuestPaymentCheckoutActions';
import { useGuestPaymentContributionActions, type GuestPaymentQuoteChoice } from './useGuestPaymentContributionActions';
import { useGuestPaymentEqualSharePlanAction } from './useGuestPaymentEqualSharePlanAction';
import { useGuestPaymentPlanRecovery } from './useGuestPaymentPlanRecovery';
import { useGuestPaymentRecovery } from './useGuestPaymentRecovery';
import { useGuestPaymentStartAction } from './useGuestPaymentStartAction';
import { useGuestPaymentWorkGate } from './useGuestPaymentWorkGate';
import { useGuestPaymentAccountState } from './useGuestPaymentAccountState';

export interface GuestAccountPaymentFlowOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly recoveryIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly returnAttemptId: string | null;
  readonly onAccountUpdated: () => void;
}

export function useGuestAccountPaymentFlow(options: GuestAccountPaymentFlowOptions) {
  const { activeIdentity, recoveryIdentity, newPaymentsEnabled, canCreatePayment, returnAttemptId, onAccountUpdated } =
    options;
  const activeIdentityRef = useRef(activeIdentity);
  activeIdentityRef.current = activeIdentity;
  const isCurrentIdentity = useCallback((identity: TableGuestVisitIdentity) => {
    const current = activeIdentityRef.current;
    return (
      current?.serviceSessionId === identity.serviceSessionId && current.participantToken === identity.participantToken
    );
  }, []);
  const gate = useGuestPaymentWorkGate();
  const returnedPaymentRefreshRef = useRef<
    (identity: TableGuestVisitIdentity, isCurrent: () => boolean, signal?: AbortSignal) => Promise<boolean>
  >(() => Promise.resolve(true));
  const onReturnedPaymentSettled = useCallback(
    (identity: TableGuestVisitIdentity, isCurrent: () => boolean, signal?: AbortSignal) =>
      returnedPaymentRefreshRef.current(identity, isCurrent, signal),
    [],
  );
  const recovery = useGuestPaymentRecovery({
    activeIdentity,
    recoveryIdentity,
    returnAttemptId,
    runExclusive: gate.runExclusive,
    onReturnedPaymentSettled,
  });
  const { setError: setRecoveryError } = recovery;
  const { account, isAccountLoading, refreshAccount } = useGuestPaymentAccountState({
    activeIdentity,
    canCreatePayment,
    setError: setRecoveryError,
  });
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  returnedPaymentRefreshRef.current = async (identity, isCurrent, signal) => {
    if (!isCurrent() || signal?.aborted) return false;
    if (!newPaymentsEnabled || !canCreatePayment) return true;
    if (identity.serviceSessionId !== activeIdentity?.serviceSessionId) return false;
    await refreshAccount(identity, isCurrent, true, signal);
    if (!isCurrent() || signal?.aborted) return false;
    onAccountUpdated();
    return true;
  };

  const planRecovery = useGuestPaymentPlanRecovery({
    activeIdentity,
    recoveryIdentity,
    newPaymentsEnabled,
    canCreatePayment,
    runExclusive: gate.runExclusive,
    refreshAccount,
    onAccountUpdated,
  });

  const canReplaceAttempt =
    canStartAnotherContribution(recovery.descriptorRef.current, recovery.operation, recovery.checkout) &&
    !recovery.isRecoveryPolling;
  const contributionActions = useGuestPaymentContributionActions({
    activeIdentity,
    newPaymentsEnabled,
    canCreatePayment,
    isRecoveryLoading: recovery.isLoading || recovery.isRecoveryPolling,
    account,
    canReplaceAttempt,
    descriptorRef: recovery.descriptorRef,
    runExclusive: gate.runExclusive,
    refreshAccount,
    publishDescriptor: recovery.publishDescriptor,
    setOperation: recovery.setOperation,
    setError: setRecoveryError,
    setStorageUnavailable,
  });
  const createEqualSharePlan = useGuestPaymentEqualSharePlanAction({
    activeIdentity,
    newPaymentsEnabled,
    canCreatePayment,
    account,
    activePlan: account?.activeEqualSharePlan ?? null,
    canReplaceAttempt,
    isPlanRecoveryBlocked: planRecovery.isBlocked || recovery.isRecoveryPolling,
    planIntentRef: planRecovery.intentRef,
    persistIntent: planRecovery.persistIntent,
    completeIntent: planRecovery.completeIntent,
    setPlanError: planRecovery.setError,
    descriptorRef: recovery.descriptorRef,
    runExclusive: gate.runExclusive,
    refreshAccount,
    setError: setRecoveryError,
    setStorageUnavailable,
  });
  const checkoutActions = useGuestPaymentCheckoutActions({
    activeIdentity,
    returnAttemptId,
    descriptorRef: recovery.descriptorRef,
    operation: recovery.operation,
    checkout: recovery.checkout,
    isRecoveryPolling: recovery.isRecoveryPolling,
    stopRecoveryPolling: recovery.stopRecoveryPolling,
    waitForWorkIdle: gate.waitForIdle,
    runExclusive: gate.runExclusive,
    publishDescriptor: recovery.publishDescriptor,
    setOperation: recovery.setOperation,
    setError: setRecoveryError,
    setStorageUnavailable,
    refreshAccount,
    onAccountUpdated,
    recoverSavedPayment: recovery.recoverSavedPayment,
    isCurrentIdentity,
  });
  const startAction = useGuestPaymentStartAction({
    activeIdentity,
    newPaymentsEnabled,
    canCreatePayment,
    isRecoveryPolling: recovery.isRecoveryPolling,
    descriptorRef: recovery.descriptorRef,
    runExclusive: gate.runExclusive,
    publishDescriptor: recovery.publishDescriptor,
    setOperation: recovery.setOperation,
    setCheckout: recovery.setCheckout,
    setError: setRecoveryError,
    setStorageUnavailable,
    refreshAccount,
    onAccountUpdated,
    recoverSavedPayment: recovery.recoverSavedPayment,
    isCurrentIdentity,
  });

  return {
    account,
    attempt: recovery.attempt,
    operation: recovery.operation,
    checkout: recovery.checkout,
    receipts: recovery.receipts,
    isLoading: recovery.isLoading,
    isRecoveryPolling: recovery.isRecoveryPolling,
    isAccountLoading,
    isWorking: gate.isWorking,
    storageUnavailable: storageUnavailable || recovery.storageUnavailable || planRecovery.storageUnavailable,
    returnReceiptUnavailable: recovery.returnReceiptUnavailable,
    error: recovery.error,
    canReplaceAttempt,
    pendingPlanIntent: planRecovery.pendingIntent,
    planRecoveryLoading: planRecovery.isLoading,
    planRecoveryBlocked: planRecovery.isBlocked,
    planRecoveryError: planRecovery.error,
    planRetryAvailable: planRecovery.retryAvailable,
    resolveOriginalPlan: planRecovery.resolveOriginalPlan,
    refreshAccount,
    reviewContribution: (quote: GuestPaymentQuoteChoice) => contributionActions.reviewContribution(quote),
    retryUnfinishedQuote: contributionActions.retryUnfinishedQuote,
    discardUnfinishedQuote: contributionActions.discardUnfinishedQuote,
    createEqualSharePlan,
    ...checkoutActions,
    ...startAction,
  };
}

function canStartAnotherContribution(
  descriptor: GuestAccountPaymentAttemptDescriptor | null,
  operation: GuestAccountPaymentOperation | null,
  checkout: GuestAccountCheckoutStatus | null,
): boolean {
  if (!descriptor) return true;
  if (!operation || !isTerminalGuestPayment(operation.state)) return false;
  if (descriptor.startRequestedAt === null) return operation.state === 'Released' || operation.state === 'Failed';
  return checkout !== null && isTerminalGuestPayment(checkout.state) && !checkout.reconciliationRequired;
}
