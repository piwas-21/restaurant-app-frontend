import { z } from 'zod';

/**
 * The queue search box shared by the Orders and History workspaces. Its value flows into the
 * URL query and then into the orders API query, so it is bounded client-side before that
 * journey; the SERVER stays authoritative over matching and pagination (C03/C10 contracts).
 *
 * Error values are i18n keys per the house convention; today the schema only bounds the
 * length, so the input's maxLength keeps typing honest and the parse guards the boundary.
 */
export const QUEUE_SEARCH_MAX = 100;

export const queueSearchSchema = z.object({
  search: z.string().max(QUEUE_SEARCH_MAX),
});

export type QueueSearchInput = z.infer<typeof queueSearchSchema>;
