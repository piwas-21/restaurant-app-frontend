/** Normalize identifier sets so order reordering cannot restart recovery checks. */
export function cashierSessionOrderScope(orderIds: readonly string[] | undefined): string | null {
  if (orderIds === undefined) return null;
  return [...new Set(orderIds.map((id) => id.toLowerCase()))]
    .sort((first, second) => first.localeCompare(second, 'en'))
    .join('\u001f');
}
