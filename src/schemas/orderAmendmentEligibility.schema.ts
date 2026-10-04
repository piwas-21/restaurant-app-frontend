import { z } from 'zod';

// Mirrors OrderAmendmentEligibilityDto; quote/commit still enforce current locked policy.
export const orderAmendmentEligibilitySchema = z
  .object({
    orderId: z.string().uuid(),
    orderVersion: z.number().int().positive().max(2_147_483_647),
    accountRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    canCreateAmendment: z.boolean(),
    amendmentMode: z.enum(['Native', 'LocalSupplementOnly', 'None']),
    reasonCode: z
      .enum([
        'featureDisabled',
        'terminalOrder',
        'closedAccount',
        'unsupportedSource',
        'financialResolutionPending',
        'paymentScopeHeld',
        'refundReconciliationRequired',
        'financialReconciliationRequired',
      ])
      .nullable(),
  })
  .refine((value) =>
    value.canCreateAmendment
      ? value.amendmentMode !== 'None' && value.reasonCode === null
      : value.amendmentMode === 'None' && value.reasonCode !== null,
  );

export type OrderAmendmentEligibility = z.infer<typeof orderAmendmentEligibilitySchema>;
