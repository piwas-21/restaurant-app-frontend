import { z } from 'zod';

export const paymentModalSchema = z
  .object({
    amount: z
      .string()
      .trim()
      .refine((value) => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0)
      .transform(Number),
    paymentMethod: z.string().trim().min(1),
    cashReceived: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.paymentMethod === 'Cash' && Number(value.cashReceived) < Number(value.amount)) {
      context.addIssue({ code: 'custom', path: ['cashReceived'], message: 'cash_received_too_low' });
    }
  });
