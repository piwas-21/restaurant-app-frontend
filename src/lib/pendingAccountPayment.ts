import { z } from 'zod';
import {
  ACCOUNT_PAYMENT_MODES,
  type CreateAccountEqualSharePlanRequest,
  type CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import { accountCashCollectionIntentSchema, type AccountCashCollectionIntent } from './accountCashCollectionIntent';

const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonNegativeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const ACCOUNT_PAYMENT_MAX_SELECTED_UNITS = 1000;
const accountPaymentUuid = z.string().uuid();
const accountPaymentCurrency = z.string().regex(/^[A-Z]{3}$/);
const unit = z
  .object({ orderId: z.string().uuid(), orderItemId: z.string().uuid(), ordinal: positiveInteger })
  .strict();
const quoteRequest = z
  .object({
    operationId: z.string().uuid(),
    expectedAccountRevision: positiveInteger,
    mode: z.enum(ACCOUNT_PAYMENT_MODES),
    paymentMethod: z.enum(['Cash', 'CreditCard']),
    selectedUnits: z.array(unit).min(1).max(ACCOUNT_PAYMENT_MAX_SELECTED_UNITS).optional(),
    amountMinor: positiveInteger.optional(),
    equalSharePlanId: z.string().uuid().optional(),
    equalShareOrdinal: positiveInteger.optional(),
    customSharePlanId: z.string().uuid().optional(),
    customShareOrdinal: positiveInteger.optional(),
    tipMinor: nonNegativeInteger.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const requiredByMode: Record<typeof request.mode, Array<keyof typeof request>> = {
      Items: ['selectedUnits'],
      Amount: ['amountMinor'],
      Equal: ['equalSharePlanId', 'equalShareOrdinal'],
      CustomAmount: ['customSharePlanId', 'customShareOrdinal'],
      Full: [],
    };
    const scopedFields: Array<keyof typeof request> = [
      'selectedUnits',
      'amountMinor',
      'equalSharePlanId',
      'equalShareOrdinal',
      'customSharePlanId',
      'customShareOrdinal',
    ];
    for (const key of requiredByMode[request.mode]) {
      if (request[key] === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: [key] });
    }
    const unrelatedFields = scopedFields.filter(
      (key) => request[key] !== undefined && !requiredByMode[request.mode].includes(key),
    );
    for (const key of unrelatedFields) context.addIssue({ code: z.ZodIssueCode.custom, path: [key] });
  });
const planRequest = z
  .object({
    operationId: z.string().uuid(),
    expectedAccountRevision: positiveInteger,
    shareCount: positiveInteger,
    supersedesPlanId: z.string().uuid().optional(),
    customAmountsMinor: z.array(positiveInteger).min(2).max(ACCOUNT_PAYMENT_MAX_SELECTED_UNITS).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.customAmountsMinor !== undefined && request.customAmountsMinor.length !== request.shareCount) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['customAmountsMinor'] });
    }
  });
const identity = { actorId: z.string().uuid(), serviceSessionId: z.string().uuid() };
const descriptor = z.union([
  z.object({ ...identity, kind: z.literal('plan'), request: planRequest }).strict(),
  z.object({ ...identity, kind: z.literal('payment'), request: quoteRequest, stage: z.literal('quote') }).strict(),
  z
    .object({
      ...identity,
      kind: z.literal('payment'),
      request: quoteRequest,
      stage: z.enum(['review', 'reserving', 'reserved', 'collecting', 'releasing']),
      expectedVersion: positiveInteger,
      currency: accountPaymentCurrency.optional(),
      cashIntent: accountCashCollectionIntentSchema.optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.cashIntent) {
        if (
          value.stage !== 'collecting' ||
          value.request.paymentMethod !== 'Cash' ||
          value.cashIntent.operationId.toLowerCase() !== value.request.operationId.toLowerCase() ||
          value.cashIntent.serviceSessionId.toLowerCase() !== value.serviceSessionId.toLowerCase() ||
          value.cashIntent.expectedVersion !== value.expectedVersion ||
          (value.currency !== undefined && value.cashIntent.settlement.currency !== value.currency)
        )
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid cash collection intent' });
      }
    }),
]);

export type PendingAccountPayment =
  | { actorId: string; serviceSessionId: string; kind: 'plan'; request: CreateAccountEqualSharePlanRequest }
  | {
      actorId: string;
      serviceSessionId: string;
      kind: 'payment';
      request: CreateAccountPaymentQuoteRequest;
      stage: 'quote' | 'review' | 'reserving' | 'reserved' | 'collecting' | 'releasing';
      expectedVersion?: number;
      currency?: string;
      cashIntent?: AccountCashCollectionIntent;
    };

type PendingAccountPaymentWrite = Extract<PendingAccountPayment, { kind: 'payment' }>;

export type PendingAccountPaymentRead =
  { status: 'none' } | { status: 'unavailable' } | { status: 'pending'; value: PendingAccountPayment };

export function normalizeAccountPaymentUuid(value: unknown): string | null {
  const parsed = accountPaymentUuid.safeParse(value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

export function isPositiveAccountPaymentInteger(value: unknown): value is number {
  return positiveInteger.safeParse(value).success;
}

function key(actorId: string, serviceSessionId: string): string {
  return `sofra.account-payment.${actorId.toLowerCase()}.${serviceSessionId.toLowerCase()}`;
}

/** A damaged descriptor blocks writes; it never becomes permission to generate a fresh operation. */
export function readPendingAccountPayment(actorId: string, serviceSessionId: string): PendingAccountPaymentRead {
  if (typeof window === 'undefined') return { status: 'unavailable' };
  try {
    const raw = window.sessionStorage.getItem(key(actorId, serviceSessionId));
    if (raw === null) return { status: 'none' };
    const parsed = descriptor.safeParse(JSON.parse(raw) as unknown);
    if (
      !parsed.success ||
      parsed.data.actorId.toLowerCase() !== actorId.toLowerCase() ||
      parsed.data.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase()
    )
      return { status: 'unavailable' };
    return { status: 'pending', value: parsed.data };
  } catch (_storageError: unknown) {
    // Invalid JSON and inaccessible storage both stay unavailable.
  }
  return { status: 'unavailable' };
}

function preservesPaymentBindings(saved: PendingAccountPaymentWrite, incoming: PendingAccountPaymentWrite): boolean {
  return (
    (saved.currency === undefined || incoming.currency === saved.currency) &&
    (saved.cashIntent === undefined || JSON.stringify(incoming.cashIntent) === JSON.stringify(saved.cashIntent))
  );
}

function canReplaceDescriptor(saved: PendingAccountPaymentRead, incoming: PendingAccountPayment): boolean {
  if (saved.status === 'unavailable') return false;
  if (saved.status === 'none') return true;
  if (
    saved.value.kind !== incoming.kind ||
    saved.value.request.operationId !== incoming.request.operationId ||
    JSON.stringify(saved.value.request) !== JSON.stringify(incoming.request)
  )
    return false;
  return (
    saved.value.kind !== 'payment' || incoming.kind !== 'payment' || preservesPaymentBindings(saved.value, incoming)
  );
}

/** Save the original operation and reviewed scope before every write, without guest names or notes. */
export function persistPendingAccountPayment(value: PendingAccountPayment): boolean {
  if (typeof window === 'undefined') return false;
  const parsed = descriptor.safeParse(value);
  if (!parsed.success) return false;
  const saved = readPendingAccountPayment(value.actorId, value.serviceSessionId);
  if (!canReplaceDescriptor(saved, parsed.data)) return false;
  try {
    window.sessionStorage.setItem(key(value.actorId, value.serviceSessionId), JSON.stringify(parsed.data));
    return true;
  } catch (_storageError: unknown) {
    // Keep storage errors private; callers hold the write lock on failure.
    return false;
  }
}

export function clearPendingAccountPayment(actorId: string, serviceSessionId: string, operationId: string): boolean {
  const saved = readPendingAccountPayment(actorId, serviceSessionId);
  if (saved.status === 'none') return true;
  if (saved.status !== 'pending' || saved.value.request.operationId !== operationId) return false;
  try {
    window.sessionStorage.removeItem(key(actorId, serviceSessionId));
    return true;
  } catch (_storageError: unknown) {
    // Keep storage errors private; callers hold the recovery lock on failure.
    return false;
  }
}
