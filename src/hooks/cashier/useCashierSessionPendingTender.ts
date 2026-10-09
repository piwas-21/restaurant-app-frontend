import { useCallback, useEffect, useRef, useState } from 'react';
import { getPaymentOperation } from '@/services/cashierService';
import {
  clearPendingPayment,
  matchesPendingPayment,
  readAnyPendingPayment,
  type PendingPaymentOperation,
  type PendingPaymentReadResult,
} from '@/lib/cashierPendingPayment';
import { usePaymentReconciliation, type PaymentOperationLookup } from './usePaymentReconciliation';
import { reportCashierRecoveryFailure } from '@/lib/cashierRecoveryDiagnostics';
import { cashierSessionOrderScope } from '@/lib/cashierSessionOrderScope';

export type CashierSessionPendingTenderStatus = 'checking' | 'clear' | 'pending' | 'unavailable' | 'settled';

export interface CashierSessionPendingTenderState {
  readonly status: CashierSessionPendingTenderStatus;
  readonly blocking: boolean;
  readonly descriptor: PendingPaymentOperation | null;
  readonly error: string | null;
  readonly check: () => Promise<void>;
}

interface InternalState extends Omit<CashierSessionPendingTenderState, 'check'> {
  readonly scopeKey: string | null;
}

interface Options {
  /** Undefined means the session bill has not loaded; an empty list is a loaded visit with no orders. */
  readonly orderIds: readonly string[] | undefined;
  readonly lookupPaymentOperation?: PaymentOperationLookup;
}

const sameIdentifier = (candidate: string | null | undefined, expected: string) =>
  typeof candidate === 'string' && candidate.toLowerCase() === expected.toLowerCase();

function isMatchingCommittedResult(
  result: Awaited<ReturnType<ReturnType<typeof usePaymentReconciliation>['reconcilePayment']>>,
  saved: PendingPaymentOperation,
): result is Extract<typeof result, { status: 'Committed' }> {
  return (
    result.status === 'Committed' &&
    sameIdentifier(result.lookup.operationId, saved.operationId) &&
    sameIdentifier(result.order.id, saved.orderId) &&
    matchesPendingPayment(saved, result.payment)
  );
}

const makeState = (
  scopeKey: string | null,
  status: CashierSessionPendingTenderStatus,
  descriptor: PendingPaymentOperation | null = null,
  error: string | null = null,
): InternalState => {
  const blocking = status !== 'clear' && status !== 'settled';
  return { scopeKey, status, blocking, descriptor, error };
};

type ScopedPendingPaymentRead = PendingPaymentReadResult | { readonly status: 'outside' };
type DescriptorForCheck =
  | { readonly status: 'pending'; readonly operation: PendingPaymentOperation }
  | { readonly status: 'clear' | 'unavailable' };

function readPendingPaymentForOrders(orderIds: ReadonlySet<string>): ScopedPendingPaymentRead {
  const result = readAnyPendingPayment();
  return result.status === 'pending' && !orderIds.has(result.operation.orderId.toLowerCase())
    ? { status: 'outside' }
    : result;
}

function descriptorForCheck(
  current: PendingPaymentOperation | null,
  orderIds: ReadonlySet<string>,
): DescriptorForCheck {
  if (current)
    return orderIds.has(current.orderId.toLowerCase())
      ? { status: 'pending', operation: current }
      : { status: 'clear' };
  const read = readPendingPaymentForOrders(orderIds);
  return read.status === 'pending'
    ? { status: 'pending', operation: read.operation }
    : { status: read.status === 'unavailable' ? 'unavailable' : 'clear' };
}

function reconciliationOutcome(
  result: Awaited<ReturnType<ReturnType<typeof usePaymentReconciliation>['reconcilePayment']>>,
  saved: PendingPaymentOperation,
): 'settled' | 'pending' | 'unavailable' {
  if (isMatchingCommittedResult(result, saved)) return 'settled';
  return result.status === 'Unknown' ? 'pending' : 'unavailable';
}

function stateForOutcome(
  scopeKey: string,
  saved: PendingPaymentOperation,
  outcome: 'settled' | 'pending' | 'unavailable',
): InternalState {
  if (outcome === 'pending') {
    return makeState(scopeKey, 'pending', { ...saved, status: 'Unknown' }, 'cashier.payment_result_unknown');
  }
  return makeState(scopeKey, 'unavailable', { ...saved, status: 'Unavailable' }, 'cashier.payment_check_failed');
}

export function useCashierSessionPendingTender({
  orderIds,
  lookupPaymentOperation = getPaymentOperation,
}: Options): CashierSessionPendingTenderState {
  const orderKey = cashierSessionOrderScope(orderIds);
  const orderIdsRef = useRef<ReadonlySet<string> | null>(null);
  orderIdsRef.current = orderIds === undefined ? null : new Set(orderIds.map((id) => id.toLowerCase()));
  const descriptorRef = useRef<PendingPaymentOperation | null>(null);
  const requestRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);
  const { reconcilePayment, cancelReconciliation } = usePaymentReconciliation(lookupPaymentOperation);
  const [state, setState] = useState<InternalState>(() => makeState(null, 'checking'));

  const check = useCallback(async (): Promise<void> => {
    if (orderKey === null || !orderIdsRef.current) return;

    const descriptor = descriptorForCheck(descriptorRef.current, orderIdsRef.current);
    if (descriptor.status !== 'pending') {
      if (descriptor.status === 'clear') descriptorRef.current = null;
      setState((current) => {
        if (descriptor.status === 'unavailable') {
          return makeState(orderKey, 'unavailable', null, 'cashier.payment_check_failed');
        }
        return current.status === 'unavailable' ? current : makeState(orderKey, 'clear');
      });
      return;
    }
    const saved = descriptor.operation;
    descriptorRef.current = saved;

    const operationKey = `${saved.orderId.toLowerCase()}\u001f${saved.operationId.toLowerCase()}`;
    if (inFlightKeyRef.current === operationKey) return;
    const requestId = ++requestRef.current;
    inFlightKeyRef.current = operationKey;
    setState(makeState(orderKey, 'checking', { ...saved, status: 'Checking' }));

    try {
      const result = await reconcilePayment(saved.orderId, saved.operationId);
      if (requestId !== requestRef.current || result.status === 'Stale') return;
      const outcome = reconciliationOutcome(result, saved);
      if (outcome === 'settled' && clearPendingPayment(saved.operationId, saved.orderId)) {
        descriptorRef.current = null;
        setState(makeState(orderKey, 'settled'));
      } else {
        setState(stateForOutcome(orderKey, saved, outcome));
      }
    } catch (error: unknown) {
      reportCashierRecoveryFailure('check visit tender', error);
      if (requestId === requestRef.current) {
        setState(
          makeState(orderKey, 'unavailable', { ...saved, status: 'Unavailable' }, 'cashier.payment_check_failed'),
        );
      }
    } finally {
      if (requestId === requestRef.current) inFlightKeyRef.current = null;
    }
  }, [orderKey, reconcilePayment]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    inFlightKeyRef.current = null;
    descriptorRef.current = null;
    if (orderKey === null) {
      setState(makeState(null, 'checking'));
      return () => {
        requestRef.current += 1;
        cancelReconciliation();
      };
    }

    const read = readPendingPaymentForOrders(orderIdsRef.current ?? new Set());
    if (read.status === 'unavailable') {
      setState(makeState(orderKey, 'unavailable', null, 'cashier.payment_check_failed'));
    } else if (read.status === 'none' || read.status === 'outside') {
      setState(makeState(orderKey, 'clear'));
    } else {
      descriptorRef.current = read.operation;
      void check();
    }

    return () => {
      requestRef.current = Math.max(requestRef.current, requestId) + 1;
      inFlightKeyRef.current = null;
      cancelReconciliation();
    };
  }, [cancelReconciliation, check, orderKey]);

  const visibleState = state.scopeKey === orderKey ? state : makeState(orderKey, 'checking');
  return {
    status: visibleState.status,
    blocking: visibleState.blocking,
    descriptor: visibleState.descriptor,
    error: visibleState.error,
    check,
  };
}
