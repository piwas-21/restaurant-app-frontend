/**
 * The public-menu data hook's per-pipeline scaffolding. The two fetchers (products, bundles) are
 * independent pipelines: disjoint state slices, each with its own loading flag, error slot,
 * pagination trio and request-id guard — see usePublicMenuData.
 */

/** Loading flag, error slot and pagination trio owned by ONE fetcher pipeline. */
export interface FetcherState {
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export const IDLE: FetcherState = { isLoading: false, error: null, currentPage: 1, totalPages: 1, totalCount: 0 };

/**
 * Extract a human error message from an unknown thrown value.
 *
 * **Blank is absence, never a message.** The second branch used to catch the empty string the
 * first one had just rejected and return it, and this value is consumed as a FLAG —
 * `MenuContent` renders its own translated sentence off `errorLoadingItems ? … : null`. So an
 * empty string disabled the error banner entirely, and `reportError` also clears the list: a dead
 * backend read as "No items in category" on the most-visited page in the app. Latent until #401
 * stopped `apiClient` manufacturing an English sentence for every failure, which is what had been
 * keeping this branch non-empty.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message.trim() || fallback;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return fallback;
}
