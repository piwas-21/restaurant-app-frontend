import { z } from 'zod';

export const paymentModalSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((value) => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0)
    .transform(Number),
  paymentMethod: z.string().trim().min(1),
});
