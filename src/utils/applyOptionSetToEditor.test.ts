import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { OptionSetDetail, OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import { applyOptionSetToEditor, optionSetHasCompleteReferences } from './applyOptionSetToEditor';

const entry = (patch: Partial<OptionSetEntry> = {}): OptionSetEntry => ({
  name: 'Garlic mayo',
  displayOrder: 0,
  isOptional: true,
  maxQuantity: 2,
  price: 1.5,
  isIncludedInBasePrice: false,
  isRequired: false,
  additionalPrice: 0.5,
  isDefault: false,
  ...patch,
});

const set = (kind: OptionSetKind, entries: OptionSetEntry[]): OptionSetDetail => ({
  id: 'set-1',
  kind,
  name: 'Sauces',
  status: 'active',
  version: 1,
  entryCount: entries.length,
  attachmentCount: 0,
  entries,
  attachments: [],
});

function editor() {
  const draft = {
    detailedIngredients: [],
    selectedSideItemIds: [],
    customizationGroups: [],
    menuDefinition: { id: 'menu-1', sections: [] },
    changeIngredients: jest.fn(),
    changeSideItemIds: jest.fn(),
    changeCustomizationGroups: jest.fn(),
    changeMenuDefinition: jest.fn(),
  };
  return draft as unknown as ReturnType<typeof useProductEditorForm>;
}

it('copies ingredient rows with their canonical IDs and prices into the unsaved item, without replacing existing rows', () => {
  const draft = editor();
  const existing = { id: 'saved-row', name: 'Onion', isOptional: false, price: 0, isActive: true, displayOrder: 0 };
  draft.detailedIngredients.push(existing);
  const changed = applyOptionSetToEditor(set('sauce', [entry({ globalIngredientId: 'global-1' })]), draft, false);
  expect(changed).toBe(true);
  const rows = (draft.changeIngredients as jest.Mock).mock.calls[0][0];
  expect(rows[0]).toBe(existing);
  expect(rows[1]).toMatchObject({ name: 'Garlic mayo', kind: 'sauce', globalIngredientId: 'global-1', price: 1.5 });
  expect(rows[1].id).toMatch(/^temp-/);
});

it('keeps a previously attached ingredient row and its ID', () => {
  const draft = editor();
  draft.detailedIngredients.push({
    id: 'saved-row',
    name: 'Garlic mayo',
    globalIngredientId: 'global-1',
    isOptional: true,
    price: 1.5,
    isActive: true,
    displayOrder: 0,
  });
  expect(applyOptionSetToEditor(set('sauce', [entry({ globalIngredientId: 'global-1' })]), draft, false)).toBe(false);
  expect(draft.changeIngredients).not.toHaveBeenCalled();
});

it('adds only new side IDs and leaves existing suggestions intact', () => {
  const draft = editor();
  draft.selectedSideItemIds.push('fries');
  expect(
    applyOptionSetToEditor(
      set('suggestedSide', [entry({ productId: 'fries' }), entry({ productId: 'salad' })]),
      draft,
      false,
    ),
  ).toBe(true);
  expect(draft.changeSideItemIds).toHaveBeenCalledWith(['fries', 'salad']);
});

it('refuses an entire set when one canonical reference is missing', () => {
  const draft = editor();
  const staleSet = set('suggestedSide', [entry({ productId: 'fries' }), entry({ productId: undefined })]);
  expect(optionSetHasCompleteReferences(staleSet)).toBe(false);
  expect(applyOptionSetToEditor(staleSet, draft, false)).toBe(false);
  expect(draft.changeSideItemIds).not.toHaveBeenCalled();
});

it('stages bundle choices as one editable section, preserving variation and surcharge', () => {
  const draft = editor();
  expect(
    applyOptionSetToEditor(
      set('bundleChoice', [entry({ productId: 'drink', productVariationId: 'large' })]),
      draft,
      true,
    ),
  ).toBe(true);
  const next = (draft.changeMenuDefinition as jest.Mock).mock.calls[0][0];
  expect(next.sections[0]).toMatchObject({ name: 'Sauces', minSelection: 1, maxSelection: 1 });
  expect(next.sections[0].items[0]).toMatchObject({
    productId: 'drink',
    productVariationId: 'large',
    additionalPrice: 0.5,
  });
});

it('stages product choices as an editable group but refuses variation-specific rows the product contract cannot save', () => {
  const draft = editor();
  expect(
    applyOptionSetToEditor(
      set('bundleChoice', [entry({ productId: 'drink', productVariationId: 'large' })]),
      draft,
      false,
    ),
  ).toBe(false);
  expect(draft.changeCustomizationGroups).not.toHaveBeenCalled();
  expect(applyOptionSetToEditor(set('bundleChoice', [entry({ productId: 'drink' })]), draft, false)).toBe(true);
  expect((draft.changeCustomizationGroups as jest.Mock).mock.calls[0][0][0].productOptions[0]).toMatchObject({
    optionProductId: 'drink',
    additionalPrice: 0.5,
  });
});
