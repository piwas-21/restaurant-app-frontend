import { z } from 'zod';
import type { AmendmentResolutionContext } from '@/schemas/amendmentResolutionContext.schema';
import { apiClient } from '@/utils/apiClient';

const identity = z
  .string()
  .uuid()
  .refine((value) => value !== '00000000-0000-0000-0000-000000000000');
const requestSchema = z
  .object({
    expectedOrderVersion: z.number().int().positive().max(2_147_483_647),
    expectedAccountRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  })
  .strict();
const responseSchema = z
  .object({
    orderId: identity,
    amendmentId: identity,
    state: z.literal('Retired'),
  })
  .strict();
const envelopeSchema = z.object({ success: z.boolean(), data: z.unknown().optional() });

/** Explicitly retires only a server-authorized, fully removed legacy earning snapshot. */
export async function prepareAmendmentEarningRetirement(
  orderId: string,
  amendmentId: string,
  context: Pick<
    AmendmentResolutionContext,
    'earningRetirementRequired' | 'expectedOrderVersion' | 'expectedAccountRevision'
  >,
): Promise<void> {
  if (!context.earningRetirementRequired) throw new Error('EarningRetirementNotRequired');
  const request = requestSchema.parse({
    expectedOrderVersion: context.expectedOrderVersion,
    expectedAccountRevision: context.expectedAccountRevision,
  });
  const response = await apiClient.post<unknown>(
    `/api/staff/orders/${encodeURIComponent(orderId)}/amendments/${encodeURIComponent(amendmentId)}/financial-resolution/prepare-earning-retirement`,
    request,
    { requireAuth: true, signOutOn401: false },
  );
  const envelope = envelopeSchema.parse(response);
  if (!envelope.success) throw new Error('EarningRetirementUnavailable');
  const result = responseSchema.parse(envelope.data);
  if (
    result.orderId.toLowerCase() !== orderId.toLowerCase() ||
    result.amendmentId.toLowerCase() !== amendmentId.toLowerCase()
  )
    throw new Error('EarningRetirementIdentityMismatch');
}
