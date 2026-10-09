import { z } from 'zod';
import { parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import type { AmendmentResolutionContext } from './amendmentResolutionContext.schema';
import { AMENDMENT_TILL_REFERENCE_MAX_LENGTH } from './amendmentResolution.schema';
import type { AmendmentResolutionQuote } from '@/types/amendmentResolution';

const invalid = 'orderAmendments.resolution_invalid_amount';
export const resolutionApprovalFormSchema = z.object({
  acknowledged: z.boolean().refine((value) => value, 'orderAmendments.resolution_acknowledgement_required'),
});
export type ResolutionApprovalForm = z.infer<typeof resolutionApprovalFormSchema>;
export function manualRefundFormSchema(context: AmendmentResolutionContext) {
  return z
    .object({
      payments: z.array(z.object({ paymentId: z.string(), amount: z.string() }).strict()),
    })
    .superRefine((value, ctx) => {
      if (value.payments.length !== context.manualRefundCandidates.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payments'], message: invalid });
        return;
      }
      let total = BigInt(0);
      value.payments.forEach((payment, index) => {
        const candidate = context.manualRefundCandidates[index];
        const amount =
          payment.amount.trim() === '' ? 0 : parseAccountContributionMinor(payment.amount, context.currency);
        if (
          payment.paymentId !== candidate.paymentId ||
          amount === null ||
          amount < 0 ||
          amount > candidate.availableMinor ||
          (payment.amount.trim() !== '' && amount === 0)
        ) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payments', index, 'amount'], message: invalid });
        } else total += BigInt(amount);
      });
      if (total > BigInt(context.creditMinor))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payments'], message: invalid });
    });
}

export type ManualRefundForm = z.infer<ReturnType<typeof manualRefundFormSchema>>;

export function tillRefundFormSchema(quote: AmendmentResolutionQuote) {
  const expected = quote.refundLegs.filter((leg) => leg.requiresTillConfirmation);
  const confirmation = z
    .object({
      paymentId: z.string().uuid(),
      tillReference: z
        .string()
        .trim()
        .max(AMENDMENT_TILL_REFERENCE_MAX_LENGTH)
        .regex(/^[A-Za-z0-9._/#-]+$/),
      cashReturnConfirmed: z.boolean(),
    })
    .strict();
  return z
    .object({ tillConfirmations: z.array(confirmation).min(1) })
    .extend({
      acknowledged: z.boolean().refine((value) => value, 'orderAmendments.resolution_acknowledgement_required'),
    })
    .superRefine((value, ctx) => {
      if (
        value.tillConfirmations.length !== expected.length ||
        value.tillConfirmations.some((entry, index) => entry.paymentId !== expected[index]?.paymentId)
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tillConfirmations'],
          message: 'orderAmendments.resolution_invalid_reference',
        });
      value.tillConfirmations.forEach((entry, index) => {
        const leg = expected[index];
        if (!leg) return;
        if (leg.cashRefund && !entry.cashReturnConfirmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tillConfirmations', index, 'cashReturnConfirmed'],
            message: 'orderAmendments.resolution_cash_return_required',
          });
        } else if (!leg.cashRefund && entry.cashReturnConfirmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tillConfirmations', index, 'cashReturnConfirmed'],
            message: 'orderAmendments.resolution_invalid_reference',
          });
        }
      });
    });
}

export type TillRefundForm = z.infer<ReturnType<typeof tillRefundFormSchema>>;
