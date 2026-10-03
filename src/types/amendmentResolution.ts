import type { z } from 'zod';
import type {
  pendingResolutionSchema,
  resolutionQuoteRequestSchema,
  resolutionQuoteSchema,
  resolutionResultSchema,
  resolutionRefusalSchema,
  resolutionOutcomeSchema,
  resolutionStartRequestSchema,
  resolutionTillConfirmationsSchema,
} from '@/schemas/amendmentResolution.schema';

export type AmendmentResolutionQuoteRequest = z.infer<typeof resolutionQuoteRequestSchema>;
export type AmendmentResolutionStartRequest = z.infer<typeof resolutionStartRequestSchema>;
export type AmendmentResolutionQuote = z.infer<typeof resolutionQuoteSchema>;
export type AmendmentResolutionResult = z.infer<typeof resolutionResultSchema>;
export type AmendmentResolutionRefusal = z.infer<typeof resolutionRefusalSchema>;
export type AmendmentResolutionOutcome = z.infer<typeof resolutionOutcomeSchema>;
export type AmendmentResolutionTillConfirmations = z.infer<typeof resolutionTillConfirmationsSchema>;
export type PendingAmendmentResolution = z.infer<typeof pendingResolutionSchema>;
