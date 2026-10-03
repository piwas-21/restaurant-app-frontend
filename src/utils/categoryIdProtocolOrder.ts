/** Keep category-ID arrays deterministic for request fingerprints and payloads. */
export function sortCategoryIds(categoryIds: Iterable<string>): string[] {
  return [...categoryIds].sort((left, right) => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
}
