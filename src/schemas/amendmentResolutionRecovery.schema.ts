import { z } from 'zod';
import {
  resolutionQuoteSchema,
  resolutionResultSchema,
  resolutionStartRequestSchema,
} from './amendmentResolution.schema';

/** Mirrors the owner-only OrderAmendmentResolutionRecoveryDto; contains no provider credentials. */
export const amendmentResolutionRecoverySchema = z
  .object({
    originalRequest: resolutionStartRequestSchema,
    reviewedQuote: resolutionQuoteSchema,
    result: resolutionResultSchema,
  })
  .strict();

export const amendmentResolutionRecoveryListSchema = z.array(amendmentResolutionRecoverySchema).max(1);
