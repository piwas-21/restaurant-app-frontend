import { z } from 'zod';

// Mirrors OrderAmendmentResolutionRequests/QuoteDto/ResultDto; backend remains authoritative.
const identity = z
  .string()
  .uuid()
  .refine((value) => value !== '00000000-0000-0000-0000-000000000000');
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = minor.positive();
const currency = z.string().regex(/^[A-Z]{3}$/);
const timestamp = z.string().datetime({ offset: true });
const custody = z.enum(['ManualTill', 'StripeDirect']);
export const resolutionTillConfirmationRequestSchema = z
  .object({
    paymentId: identity,
    tillReference: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._/#-]{1,80}$/),
  })
  .strict();
export const resolutionTillConfirmationsSchema = z.array(resolutionTillConfirmationRequestSchema).min(1);

export const resolutionQuoteRequestSchema = z
  .object({
    clientOperationId: identity,
    expectedOrderVersion: positive.max(2_147_483_647),
    expectedAccountRevision: positive.nullable().optional(),
    currency,
    manualRefunds: z.array(z.object({ paymentId: identity, amountMinor: positive }).strict()),
  })
  .strict();

export const resolutionStartRequestSchema = z
  .object({
    quote: resolutionQuoteRequestSchema,
    quoteHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
    expiresAt: timestamp,
  })
  .strict();

const refundScope = z.object({
  allocationId: identity,
  orderItemId: identity.nullable(),
  startOrdinal: positive.max(2_147_483_647),
  unitCount: positive.max(2_147_483_647),
  minorPerUnit: minor,
  amountMinor: minor,
});

export const resolutionQuoteSchema = z.object({
  orderId: identity,
  amendmentId: identity,
  clientOperationId: identity,
  quoteHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  expiresAt: timestamp,
  currency,
  creditMinor: positive,
  refundMinor: minor,
  unpaidWaivedMinor: minor,
  refundLegs: z.array(
    z.object({
      paymentId: identity,
      paymentMethod: z.enum(['Cash', 'CreditCard', 'OnlinePayment']),
      custody,
      amountMinor: positive,
      requiresTillConfirmation: z.boolean(),
      scopes: z.array(refundScope),
    }),
  ),
});

export const resolutionResultSchema = z.object({
  operationId: identity,
  clientOperationId: identity,
  amendmentId: identity,
  sourceOrderId: identity,
  state: z.enum(['Processing', 'ReconciliationRequired', 'Resolved']),
  currency,
  creditMinor: positive,
  refundMinor: minor,
  unpaidWaivedMinor: minor,
  startedAt: timestamp,
  resolvedAt: timestamp.nullable(),
  refundLegs: z.array(
    z.object({
      paymentId: identity,
      custody,
      state: z.enum(['Processing', 'Pending', 'Failed', 'ReconciliationRequired', 'Succeeded']),
      amountMinor: positive,
      resolvedAt: timestamp.nullable(),
      tillConfirmation: z
        .object({
          tillReference: z.string().regex(/^[A-Za-z0-9._/#-]{1,80}$/),
          confirmedAt: timestamp,
        })
        .strict()
        .nullable()
        .optional(),
    }),
  ),
});

const refusalCode = z.enum(['quoteExpired', 'sourceVersionConflict', 'accountRevisionConflict', 'quoteChanged']);

export const resolutionRefusalSchema = z
  .object({
    actorUserId: identity,
    orderId: identity,
    amendmentId: identity,
    clientOperationId: identity,
    requestHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
    failureCode: refusalCode,
    createdAt: timestamp,
    originalRequest: resolutionStartRequestSchema,
  })
  .strict();

export const resolutionOutcomeSchema = z.discriminatedUnion('outcome', [
  z
    .object({
      outcome: z.literal('accepted'),
      result: resolutionResultSchema,
      refusal: z.null().optional(),
    })
    .strict(),
  z
    .object({
      outcome: z.literal('refused'),
      refusal: resolutionRefusalSchema,
      result: z.null().optional(),
    })
    .strict(),
]);

export const pendingResolutionSchema = z
  .object({
    actorId: identity,
    orderId: identity,
    amendmentId: identity,
    request: resolutionStartRequestSchema,
    reviewedQuote: resolutionQuoteSchema,
    operationId: identity.nullable(),
    pendingTillConfirmations: resolutionTillConfirmationsSchema.optional(),
  })
  .strict();
