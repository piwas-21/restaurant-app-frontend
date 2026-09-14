import type { ProductCustomizationGroupDraft } from '@/types/menu';

export function areCustomizationGroupsValid(groups: ProductCustomizationGroupDraft[]): boolean {
  return groups.every((group) => {
    const optionCount = group.ingredientOptions.length + group.productOptions.length;
    return (
      Boolean(group.name.trim()) &&
      group.minSelection >= 0 &&
      group.maxSelection >= group.minSelection &&
      group.maxSelection <= optionCount &&
      group.includedFreeUnits >= 0 &&
      group.includedFreeUnits <= group.maxSelection &&
      (!group.isRequired || group.minSelection > 0)
    );
  });
}
