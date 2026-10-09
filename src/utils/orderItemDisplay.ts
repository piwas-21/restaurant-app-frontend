import type { OrderItemDto } from '@/types/order';

/** Group known menu-section siblings while keeping unknown rows individually positioned. */
export function orderItemsForDisplay<T extends { sectionId?: string | null }>(items: readonly T[]): T[] {
  const groups: T[][] = [];
  const bySection = new Map<string, T[]>();

  for (const item of items) {
    const sectionId = item.sectionId?.trim();
    if (!sectionId) {
      groups.push([item]);
      continue;
    }

    const existingGroup = bySection.get(sectionId);
    if (existingGroup) {
      existingGroup.push(item);
      continue;
    }

    const newGroup = [item];
    bySection.set(sectionId, newGroup);
    groups.push(newGroup);
  }

  return groups.flat();
}

/** Hide a legacy note only when it repeats the selected variation verbatim. */
export function displaySpecialInstructions(
  item: Pick<OrderItemDto, 'specialInstructions' | 'variationName'>,
): string | undefined {
  const instructions = item.specialInstructions?.trim();
  if (!instructions) return undefined;

  const variation = item.variationName?.trim();
  if (variation && normalizeDisplayText(instructions) === normalizeDisplayText(variation)) {
    return undefined;
  }

  return instructions;
}

function normalizeDisplayText(value: string): string {
  return value.replace(/\s+/g, ' ').toLowerCase();
}
