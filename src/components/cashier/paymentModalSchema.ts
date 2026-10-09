import { z } from 'zod';

const safeMinorAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const paymentModalSchema = z
  .object({
    amount: z
      .string()
      .trim()
      .refine((value) => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0),
    amountMinor: safeMinorAmount,
    tipMinor: safeMinorAmount,
    paymentMethod: z.string().trim().min(1),
    cashReceivedMinor: safeMinorAmount.optional(),
  })
  .superRefine((value, context) => {
    if (value.paymentMethod === 'Cash' && (value.cashReceivedMinor ?? 0) < value.amountMinor + value.tipMinor) {
      context.addIssue({ code: 'custom', path: ['cashReceivedMinor'], message: 'cash_received_too_low' });
    }
  });
