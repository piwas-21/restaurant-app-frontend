import type { OptionSetKind } from '@/types/optionSet';

const ITEM_OPTIONS: readonly OptionSetKind[] = ['bundleChoice', 'suggestedSide'];
const ITEM_RECIPE: readonly OptionSetKind[] = ['ingredient', 'sauce'];
const BUNDLE: readonly OptionSetKind[] = ['bundleChoice'];

export function optionSetKindsForSection(isBundle: boolean, sectionId: string): readonly OptionSetKind[] | null {
  if (isBundle) return sectionId === 'editor-section-basics' ? BUNDLE : null;
  if (sectionId === 'editor-section-options') return ITEM_OPTIONS;
  return sectionId === 'editor-section-recipe' ? ITEM_RECIPE : null;
}
