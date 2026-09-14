import type {
  CustomizationGroupCarrier,
  CustomizationGroupSelection,
  CustomizationOptionSelection,
  ProductCustomizationGroup,
} from '@/types/menu';

export function activeCustomizationGroups(carrier: CustomizationGroupCarrier | null | undefined) {
  return (carrier?.customizationGroups ?? [])
    .filter((group) => group.isActive)
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

/** Defaults are expressed by membership id, preserving identity when one target appears twice. */
export function defaultCustomizationSelections(
  carrier: CustomizationGroupCarrier | null | undefined,
): CustomizationGroupSelection[] {
  return activeCustomizationGroups(carrier).map((group) => ({
    groupId: group.id,
    options: [
      ...group.ingredientOptions
        .filter((option) => option.isDefault)
        .map((option) => ({ kind: 0 as const, optionId: option.id, quantity: 1 })),
      ...group.productOptions
        .filter((option) => option.isDefault)
        .map((option) => ({ kind: 1 as const, optionId: option.id, quantity: 1 })),
    ],
  }));
}

export function selectionForGroup(
  selections: readonly CustomizationGroupSelection[],
  groupId: string,
): readonly CustomizationOptionSelection[] {
  return selections.find((selection) => selection.groupId === groupId)?.options ?? [];
}

export function updateGroupSelection(
  selections: readonly CustomizationGroupSelection[],
  groupId: string,
  options: CustomizationOptionSelection[],
): CustomizationGroupSelection[] {
  const next = selections.map((selection) => (selection.groupId === groupId ? { ...selection, options } : selection));
  return next.some((selection) => selection.groupId === groupId) ? next : [...next, { groupId, options }];
}

export function customizationGroupSatisfied(
  group: ProductCustomizationGroup,
  selections: readonly CustomizationGroupSelection[],
): boolean {
  // The server validates distinct memberships, not the sum of their quantities.
  const units = selectionForGroup(selections, group.id).length;
  const minimum = group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;
  return units >= minimum && units <= group.maxSelection;
}

export function ingredientIdsForSelections(
  groups: readonly ProductCustomizationGroup[],
  selections: readonly CustomizationGroupSelection[],
): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    const chosen = new Set(
      selectionForGroup(selections, group.id)
        .filter((row) => row.kind === 0)
        .map((row) => row.optionId),
    );
    group.ingredientOptions
      .filter((option) => chosen.has(option.id))
      .forEach((option) => ids.add(option.productIngredientId));
  }
  return [...ids];
}
