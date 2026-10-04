import { z } from 'zod';
import type { AccountCashReceipt, AccountCashSettlement } from '@/types/accountCashSettlement';
import type { AccountPaymentOperation } from '@/types/accountPayments';

const SWISS_CASH_INCREMENT_MINOR = BigInt(5);
const SWISS_CASH_ROUND_UP_REMAINDER = BigInt(3);
const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const safeInteger = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const positiveMinor = safeInteger.positive();
const terms = {
  policyVersion: z.enum(['chf-cash-5-rappen-v1', 'exact-v1']),
  currency: z.string().regex(/^[A-Z]{3}$/),
  exactAmountMinor: positiveMinor,
  adjustmentMinor: safeInteger,
  dueAmountMinor: positiveMinor,
};
export const accountCashSettlementSchema = z
  .object({ ...terms, paymentMethod: z.enum(['Cash', 'CreditCard', 'OnlinePayment']) })
  .strict();
const receiptSchema = z
  .object({
    ...terms,
    receivedMinor: positiveMinor,
    changeMinor: safeInteger.nonnegative(),
    capturedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type AccountCashEvidence =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'valid'; settlement: AccountCashSettlement; receipt: AccountCashReceipt | null };

/** Resolves a previously frozen policy for a retained exact amount; zero is valid after a full refund. */
export function accountCashDueFromPolicy(
  policyVersion: string,
  currency: string,
  paymentMethod: AccountPaymentOperation['paymentMethod'],
  exactAmountMinor: number,
): number | null {
  if (!Number.isSafeInteger(exactAmountMinor) || exactAmountMinor < 0) return null;
  if (policyVersion === 'exact-v1') return paymentMethod !== 'Cash' || currency !== 'CHF' ? exactAmountMinor : null;
  if (policyVersion !== 'chf-cash-5-rappen-v1' || currency !== 'CHF' || paymentMethod !== 'Cash') return null;

  const exact = BigInt(exactAmountMinor);
  const remainder = exact % SWISS_CASH_INCREMENT_MINOR;
  const due = exact - remainder + (remainder >= SWISS_CASH_ROUND_UP_REMAINDER ? SWISS_CASH_INCREMENT_MINOR : BigInt(0));
  return due <= MAX_SAFE_MINOR ? Number(due) : null;
}

function hasConservedTerms(settlement: AccountCashSettlement, operation: AccountPaymentOperation): boolean {
  if (
    settlement.currency !== operation.currency ||
    settlement.paymentMethod !== operation.paymentMethod ||
    settlement.exactAmountMinor !== operation.amountMinor
  )
    return false;
  const exact = BigInt(settlement.exactAmountMinor);
  const due = BigInt(settlement.dueAmountMinor);
  const expectedDue = accountCashDueFromPolicy(
    settlement.policyVersion,
    settlement.currency,
    settlement.paymentMethod,
    settlement.exactAmountMinor,
  );
  return expectedDue !== null && due === exact + BigInt(settlement.adjustmentMinor) && due === BigInt(expectedDue);
}

function receiptMatches(receipt: AccountCashReceipt, settlement: AccountCashSettlement): boolean {
  return (
    receipt.policyVersion === settlement.policyVersion &&
    receipt.currency === settlement.currency &&
    receipt.exactAmountMinor === settlement.exactAmountMinor &&
    receipt.adjustmentMinor === settlement.adjustmentMinor &&
    receipt.dueAmountMinor === settlement.dueAmountMinor &&
    receipt.receivedMinor >= receipt.dueAmountMinor &&
    BigInt(receipt.changeMinor) === BigInt(receipt.receivedMinor) - BigInt(receipt.dueAmountMinor)
  );
}

/** Missing legacy evidence is unattested; it never becomes permission to invent physical cash terms. */
export function readAccountCashEvidence(operation: AccountPaymentOperation): AccountCashEvidence {
  if (operation.cashSettlement === null || operation.cashSettlement === undefined)
    return { status: operation.cashReceipt === null || operation.cashReceipt === undefined ? 'missing' : 'invalid' };
  const parsed = accountCashSettlementSchema.safeParse(operation.cashSettlement);
  if (!parsed.success || !hasConservedTerms(parsed.data, operation)) return { status: 'invalid' };
  if (operation.cashReceipt === null || operation.cashReceipt === undefined) {
    if (operation.paymentMethod === 'Cash' && operation.state === 'Captured') return { status: 'invalid' };
    return { status: 'valid', settlement: parsed.data, receipt: null };
  }
  const receipt = receiptSchema.safeParse(operation.cashReceipt);
  if (
    !receipt.success ||
    operation.state !== 'Captured' ||
    operation.paymentMethod !== 'Cash' ||
    !receiptMatches(receipt.data, parsed.data)
  )
    return { status: 'invalid' };
  return { status: 'valid', settlement: parsed.data, receipt: receipt.data };
}

export function canCollectReviewedCash(operation: AccountPaymentOperation, receivedMinor: number | undefined): boolean {
  const evidence = readAccountCashEvidence(operation);
  return (
    operation.paymentMethod === 'Cash' &&
    operation.state === 'Reserved' &&
    evidence.status === 'valid' &&
    evidence.receipt === null &&
    positiveMinor.safeParse(receivedMinor).success &&
    receivedMinor !== undefined &&
    receivedMinor >= evidence.settlement.dueAmountMinor
  );
}
