import type { ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { MenuSection, MenuSectionItem, ProductCustomizationGroupDraft } from '@/types/menu';
import type { OptionSetDetail, OptionSetEntry } from '@/types/optionSet';
import { nextTemporaryIngredientId } from '@/components/admin/product/globalIngredientLibrary';
import { createTemporaryMenuId } from '@/utils/menuSectionVersioning';

type Editor = ReturnType<typeof useProductEditorForm>;

export function optionSetHasCompleteReferences(set: OptionSetDetail): boolean {
  if (set.kind === 'ingredient' || set.kind === 'sauce') {
    return set.entries.every((entry) => Boolean(entry.globalIngredientId));
  }
  return set.entries.every((entry) => Boolean(entry.productId));
}

function alreadyHasBundleChoices(
  editor: Editor,
  set: OptionSetDetail,
  entries: Array<OptionSetEntry & { productId: string }>,
) {
  return editor.menuDefinition.sections.some(
    (section) =>
      section.name === set.name &&
      section.items.length === entries.length &&
      section.items.every((item) =>
        entries.some(
          (entry) =>
            entry.productId === item.productId &&
            (entry.productVariationId ?? null) === (item.productVariationId ?? null),
        ),
      ),
  );
}

function alreadyHasProductChoices(
  editor: Editor,
  set: OptionSetDetail,
  entries: Array<OptionSetEntry & { productId: string }>,
) {
  return editor.customizationGroups.some(
    (group) =>
      group.name === set.name &&
      group.productOptions.length === entries.length &&
      group.productOptions.every((option) => entries.some((entry) => entry.productId === option.optionProductId)),
  );
}

function addIngredients(set: OptionSetDetail, editor: Editor): boolean {
  const existing = new Set(
    editor.detailedIngredients.flatMap((row) => [
      row.globalIngredientId ? `id:${row.globalIngredientId}` : '',
      `name:${row.name.trim().toLocaleLowerCase()}`,
    ]),
  );
  const additions: ProductIngredient[] = set.entries
    .filter((entry) => {
      if (!entry.globalIngredientId) return false;
      const keys = [`id:${entry.globalIngredientId}`, `name:${entry.name.trim().toLocaleLowerCase()}`];
      if (keys.some((key) => existing.has(key))) return false;
      keys.forEach((key) => existing.add(key));
      return true;
    })
    .map((entry, index) => ({
      id: nextTemporaryIngredientId(),
      name: entry.name,
      globalIngredientId: entry.globalIngredientId,
      kind: set.kind === 'sauce' ? 'sauce' : 'ingredient',
      isOptional: entry.isOptional,
      maxQuantity: entry.maxQuantity,
      price: entry.price,
      isIncludedInBasePrice: entry.isIncludedInBasePrice,
      isActive: true,
      displayOrder: editor.detailedIngredients.length + index,
      content: {},
    }));
  if (additions.length === 0) return false;
  editor.changeIngredients([...editor.detailedIngredients, ...additions]);
  return true;
}

function addSides(set: OptionSetDetail, editor: Editor): boolean {
  const ids = [
    ...new Set([
      ...editor.selectedSideItemIds,
      ...set.entries.map((entry) => entry.productId).filter((id): id is string => Boolean(id)),
    ]),
  ];
  if (ids.length === editor.selectedSideItemIds.length) return false;
  editor.changeSideItemIds(ids);
  return true;
}

/** Stage an independent copy in the editor. The page's ordinary Save owns the only write. */
export function applyOptionSetToEditor(set: OptionSetDetail, editor: Editor, isBundle: boolean): boolean {
  if (set.status !== 'active' || set.entries.length === 0 || !optionSetHasCompleteReferences(set)) return false;
  if (!isBundle && (set.kind === 'ingredient' || set.kind === 'sauce')) return addIngredients(set, editor);
  if (!isBundle && set.kind === 'suggestedSide') return addSides(set, editor);
  if (set.kind !== 'bundleChoice') return false;
  const entries = set.entries.filter((entry): entry is OptionSetEntry & { productId: string } =>
    Boolean(entry.productId),
  );
  if (entries.length === 0) return false;
  if (isBundle) {
    if (alreadyHasBundleChoices(editor, set, entries)) return false;
    const items: MenuSectionItem[] = entries.map((entry, index) => ({
      id: createTemporaryMenuId(),
      productId: entry.productId,
      productVariationId: entry.productVariationId,
      productName: entry.name,
      additionalPrice: entry.additionalPrice,
      displayOrder: index,
      isDefault: entry.isDefault,
    }));
    const section: MenuSection = {
      id: createTemporaryMenuId(),
      name: set.name,
      description: '',
      translations: Object.fromEntries(
        Object.entries(set.translations ?? {}).map(([locale, name]) => [locale, { name }]),
      ),
      displayOrder: editor.menuDefinition.sections.length,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items,
    };
    editor.changeMenuDefinition({ ...editor.menuDefinition, sections: [...editor.menuDefinition.sections, section] });
    return true;
  }
  // Product choice groups cannot represent a variation-specific option; keep the set intact.
  if (entries.some((entry) => entry.productVariationId)) return false;
  if (alreadyHasProductChoices(editor, set, entries)) return false;
  const group: ProductCustomizationGroupDraft = {
    name: set.name,
    displayOrder: editor.customizationGroups.length,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    includedFreeUnits: 0,
    isActive: true,
    content: Object.fromEntries(
      Object.entries(set.translations ?? {}).map(([locale, name]) => [locale, { name, description: '' }]),
    ),
    ingredientOptions: [],
    productOptions: entries.map((entry, index) => ({
      optionProductId: entry.productId,
      optionProductName: entry.name,
      additionalPrice: entry.additionalPrice,
      displayOrder: index,
      isDefault: entry.isDefault,
    })),
  };
  editor.changeCustomizationGroups([...editor.customizationGroups, group]);
  return true;
}
