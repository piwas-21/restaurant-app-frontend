import { useCallback, useEffect, useRef, useState } from 'react';
import { getPaymentOperation } from '@/services/cashierService';
import type { OrderDto, OrderPaymentDto, PaymentOperationLookupDto } from '@/types/order';
import { ApiError } from '@/utils/apiClient';

/** A lookup function is injected so the workflow stays easy to test and reuse. */
export type PaymentOperationLookup = (orderId: string, operationId: string) => Promise<PaymentOperationLookupDto>;

export type PaymentWriteErrorClassification = 'unknown' | 'definitive';

/**
 * Classify a failed payment write by whether its outcome is knowable from the response.
 *
 * A 4xx response is a server refusal and is therefore definitive. A network error, timeout,
 * rate-limit, or 5xx response may have happened after the server committed the tender, so callers
 * must reconcile by operation id instead of sending the tender again.
 */
export function classifyPaymentWriteError(error: unknown): PaymentWriteErrorClassification {
  if (error instanceof ApiError) {
    const uncertainStatus =
      error.status === HTTP_STATUS_TRANSPORT_FAILURE ||
      error.status === HTTP_STATUS_REQUEST_TIMEOUT ||
      error.status === HTTP_STATUS_RATE_LIMITED ||
      error.status >= HTTP_STATUS_SERVER_ERROR_MIN;
    return uncertainStatus ? 'unknown' : 'definitive';
  }

  if (error instanceof TypeError || isAbortError(error) || isTransportCode(error)) return 'unknown';
  return 'definitive';
}

/** True when a POST failure must be followed by an operation lookup, never a blind retry. */
export function isPaymentOutcomeUnknown(error: unknown): boolean {
  return classifyPaymentWriteError(error) === 'unknown';
}

/**
 * The result consumed by the cashier dialog. `Stale` is local-only and means that a newer check or
 * unmount won the race; it must not produce a toast, close a modal, or change the selected order.
 */
export type PaymentReconciliationResult =
  | {
      status: 'Committed';
      payment: OrderPaymentDto;
      order: OrderDto;
      lookup: PaymentOperationLookupDto;
    }
  | {
      status: 'Unknown';
      payment: OrderPaymentDto | null;
      order: OrderDto | null;
      lookup: PaymentOperationLookupDto;
    }
  | { status: 'Unavailable'; error?: unknown }
  | { status: 'Stale' };

interface CodedTransportError {
  readonly code?: unknown;
  readonly name?: unknown;
}

const HTTP_STATUS_TRANSPORT_FAILURE = 0;
const HTTP_STATUS_REQUEST_TIMEOUT = 408;
const HTTP_STATUS_RATE_LIMITED = 429;
const HTTP_STATUS_SERVER_ERROR_MIN = 500;

const TRANSPORT_ERROR_CODES = new Set(['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']);

function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) return error.name === 'AbortError';
  return isCodedTransportError(error) && error.name === 'AbortError';
}

function isCodedTransportError(error: unknown): error is CodedTransportError {
  return typeof error === 'object' && error !== null;
}

function isTransportCode(error: unknown): boolean {
  if (!isCodedTransportError(error) || typeof error.code !== 'string') return false;
  return TRANSPORT_ERROR_CODES.has(error.code);
}

function sameIdentifier(left: unknown, right: string): boolean {
  return typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
}

function isLookupFor(lookup: PaymentOperationLookupDto, operationId: string): boolean {
  return sameIdentifier(lookup.operationId, operationId);
}

function hasRequestedOrder(lookup: PaymentOperationLookupDto, orderId: string): boolean {
  return !lookup.order || sameIdentifier(lookup.order.id, orderId);
}

function hasMatchingPayment(lookup: PaymentOperationLookupDto, orderId: string, operationId: string): boolean {
  if (!lookup.payment) return false;
  const paymentOrderMatches = lookup.payment.orderId ? sameIdentifier(lookup.payment.orderId, orderId) : true;
  const paymentOperationMatches = sameIdentifier(lookup.payment.operationId, operationId);
  return paymentOrderMatches && paymentOperationMatches;
}

/**
 * Reconciles one uncertain POST. The hook owns lifecycle and race guards; the caller decides how
 * to present each result. It never retries the POST and never creates a new operation id.
 */
export function usePaymentReconciliation(lookupPaymentOperation: PaymentOperationLookup = getPaymentOperation): {
  isCheckingPayment: boolean;
  isChecking: boolean;
  reconcilePayment: (orderId: string, operationId: string) => Promise<PaymentReconciliationResult>;
  cancelReconciliation: () => void;
} {
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const mountedRef = useRef(true);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      latestRequestRef.current += 1;
    };
  }, []);

  const cancelReconciliation = useCallback(() => {
    latestRequestRef.current += 1;
    if (mountedRef.current) setIsCheckingPayment(false);
  }, []);

  const reconcilePayment = useCallback(
    async (orderId: string, operationId: string): Promise<PaymentReconciliationResult> => {
      if (!mountedRef.current) return { status: 'Stale' };
      const requestId = ++latestRequestRef.current;
      setIsCheckingPayment(true);

      const isCurrent = () => mountedRef.current && requestId === latestRequestRef.current;
      try {
        const lookup = await lookupPaymentOperation(orderId, operationId);
        if (!isCurrent()) return { status: 'Stale' };

        if (!isLookupFor(lookup, operationId) || !hasRequestedOrder(lookup, orderId)) {
          return { status: 'Unavailable' };
        }
        if (
          lookup.status === 'Committed' &&
          lookup.order &&
          lookup.payment &&
          hasMatchingPayment(lookup, orderId, operationId)
        ) {
          return {
            status: 'Committed',
            payment: lookup.payment,
            order: lookup.order,
            lookup,
          };
        }
        if (lookup.status === 'Unknown') {
          return {
            status: 'Unknown',
            payment: null,
            order: lookup.order,
            lookup,
          };
        }
        return { status: 'Unavailable' };
      } catch (error) {
        if (!isCurrent()) return { status: 'Stale' };
        return { status: 'Unavailable', error };
      } finally {
        if (isCurrent()) setIsCheckingPayment(false);
      }
    },
    [lookupPaymentOperation],
  );

  return { isCheckingPayment, isChecking: isCheckingPayment, reconcilePayment, cancelReconciliation };
}
