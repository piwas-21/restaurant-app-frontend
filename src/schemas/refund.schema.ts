import { z } from 'zod';

export const REFUND_REASON_MIN_LENGTH = 5;

export const refundSchema = (maxRefundAmount: number) =>
  z
    .object({
      paymentId: z.string().trim().min(1, 'cashier.select_payment_to_refund'),
      reason: z.string().trim().min(REFUND_REASON_MIN_LENGTH, 'cashier.refund_reason_min_length'),
      refundType: z.enum(['full', 'partial']),
      refundAmount: z.string(),
    })
    .superRefine((value, context) => {
      if (value.refundType === 'full') {
        if (maxRefundAmount <= 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['refundAmount'],
            message: 'cashier.refund_amount_required',
          });
        }
        return;
      }

      const amount = Number(value.refundAmount);
      if (!value.refundAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['refundAmount'],
          message: 'cashier.refund_amount_required',
        });
      } else if (amount > maxRefundAmount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['refundAmount'],
          message: 'cashier.refund_exceeds_payment',
        });
      }
    });

export type RefundFormInput = z.infer<ReturnType<typeof refundSchema>>;
