/** Bounded read limits for the public, immutable catalogue preview API. */
export const CATALOGUE_SEARCH_PAGE_SIZE = 24;
export const CATALOGUE_SEARCH_MAX_PAGE_SIZE = 24;
export const CATALOGUE_SEARCH_QUERY_DEBOUNCE_MS = 250;
export const CATALOGUE_PREVIEW_MAX_DEPENDENCIES = 24;
export const CATALOGUE_PREVIEW_DEPENDENCY_CONCURRENCY = 4;

export function boundedCatalogueSearchPageSize(requested?: number): number {
  const value = requested ?? CATALOGUE_SEARCH_PAGE_SIZE;
  const finiteValue = Number.isFinite(value) ? Math.floor(value) : CATALOGUE_SEARCH_PAGE_SIZE;
  return Math.min(CATALOGUE_SEARCH_MAX_PAGE_SIZE, Math.max(1, finiteValue));
}
