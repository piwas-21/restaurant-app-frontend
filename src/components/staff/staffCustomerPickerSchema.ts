import { z } from 'zod';

const optionalEmail = z
  .string()
  .trim()
  .max(100)
  .refine((value) => value === '' || z.string().email().safeParse(value).success);

export const staffCustomerPickerSchema = (maximumPoints: number) =>
  z.object({
    customerName: z.string().trim().max(100),
    customerEmail: optionalEmail,
    customerPhone: z.string().trim().max(20),
    pointsToRedeem: z.coerce.number().int().min(0).max(maximumPoints),
  });
