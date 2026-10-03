'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentEligibility } from '@/schemas/orderAmendmentEligibility.schema';
import { getOrderAmendmentEligibility } from '@/services/orderAmendmentEligibilityService';

interface Result {
  readonly key: string;
  readonly value?: OrderAmendmentEligibility;
  readonly failed?: boolean;
}
const blockers: Record<NonNullable<OrderAmendmentEligibility['reasonCode']>, string> = {
  featureDisabled: 'orderAmendments.feature_disabled',
  terminalOrder: 'orderAmendments.order_refund_activity',
  closedAccount: 'orderAmendments.visit_unavailable',
  unsupportedSource: 'orderAmendments.provider_changes_blocked',
  financialResolutionPending: 'orderAmendments.resolution_pending',
  paymentScopeHeld: 'orderAmendments.resolution_payment_held',
  refundReconciliationRequired: 'orderAmendments.order_refund_activity',
  financialReconciliationRequired: 'orderAmendments.resolution_context_failed',
};

export function useOrderAmendmentEligibility(order: OrderDto, actorId: string | undefined, enabled: boolean) {
  const key = `${actorId}:${order.id}:${order.version}:${enabled}`;
  const [result, setResult] = useState<Result | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(() => {
    setResult(null);
    setRetryVersion((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!enabled || !actorId) return;
    let current = true;
    void getOrderAmendmentEligibility(order.id).then(
      (value) => {
        if (current) setResult({ key, value });
      },
      () => {
        if (current) setResult({ key, failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, [actorId, enabled, key, order.id, retryVersion]);
  const value = result?.key === key ? result.value : undefined;
  let reason: string | null = null;
  if (result?.key === key && result.failed) reason = 'orderAmendments.resolution_context_failed';
  else if (!value) reason = 'orderAmendments.resolution_checking';
  else if (value.orderVersion !== order.version) reason = 'orderAmendments.order_changed_refresh';
  else if (value.canCreateAmendment !== true)
    reason = value.reasonCode ? blockers[value.reasonCode] : 'orderAmendments.resolution_context_failed';
  return { reason, retry, mode: value?.amendmentMode, ready: enabled && !!actorId && reason === null };
}
