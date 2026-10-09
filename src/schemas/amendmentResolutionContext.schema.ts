import { z } from 'zod';
import { resolutionQuoteRequestSchema } from './amendmentResolution.schema';

// Mirrors the Admin-only OrderAmendmentResolutionContextDto; no provider or payer secrets.
const request = resolutionQuoteRequestSchema.shape;
export const amendmentResolutionContextSchema = z
  .object({
    orderId: request.clientOperationId,
    amendmentId: request.clientOperationId,
    expectedOrderVersion: request.expectedOrderVersion,
    expectedAccountRevision: request.expectedAccountRevision.unwrap(),
    currency: request.currency,
    creditMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    earningRetirementRequired: z.boolean().optional().default(false),
    manualRefundCandidates: z.array(
      z.object({
        paymentId: request.clientOperationId,
        paymentMethod: z.enum(['Cash', 'CreditCard']),
        availableMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const ids = value.manualRefundCandidates.map((payment) => payment.paymentId.toLowerCase());
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom });
  });

export type AmendmentResolutionContext = z.infer<typeof amendmentResolutionContextSchema>;
