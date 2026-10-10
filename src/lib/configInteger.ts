export function positiveIntegerConfig(raw: string | undefined, fallback: number): number {
  const configured = Number((raw ?? '').trim());
  return Number.isSafeInteger(configured) && configured > 0 ? configured : fallback;
}
