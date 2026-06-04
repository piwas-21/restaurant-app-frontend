/**
 * Builds a URL query string (`?a=1&b=2`) from a filters object, skipping
 * undefined/null values. Returns an empty string when there are no params.
 * Shared by the order read endpoints (extracted from the duplicated inline
 * URLSearchParams blocks in orderService — Sprint 4/6 service split).
 */
export function buildQueryString(filters?: object): string {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}
