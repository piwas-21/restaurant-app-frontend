/** Compare strings by UTF-16 code-unit order, independent of the active locale. */
export function compareOrdinalStrings(first: string, second: string): number {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}
