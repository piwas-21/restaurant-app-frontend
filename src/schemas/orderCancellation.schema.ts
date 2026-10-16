import { z } from 'zod';

export const cancellationReasonMaxLength = 500;

export function orderCancellationSchema(reasonTooLong: string) {
  return z.object({
    cancellationReason: z.string().trim().max(cancellationReasonMaxLength, reasonTooLong),
  });
}
