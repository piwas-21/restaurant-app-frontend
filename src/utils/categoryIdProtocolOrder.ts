/** Keep category-ID arrays deterministic for request fingerprints and payloads. */
export function sortCategoryIds(categoryIds: Iterable<string>): string[] {
  return [...categoryIds].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
