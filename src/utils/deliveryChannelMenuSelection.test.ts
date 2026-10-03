import type {
  DeliveryChannelCategoryCandidate,
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryItem,
  DeliveryChannelCategorySummary,
} from '@/types/deliveryChannelMenuSelection';
import {
  categoryItemIsSelected,
  categoryOverrideRequests,
  categorySelectionCount,
  categorySelectionState,
  categoryUnsupportedSelectionCount,
  categoryOverrideMap,
  normalizedCategoryOverrides,
  toggleCategorySelection,
  updateCategoryItemOverride,
} from './deliveryChannelMenuSelection';

const categories: DeliveryChannelCategorySummary[] = [
  {
    categoryId: 'cat-1',
    name: 'Mains',
    displayOrder: 1,
    totalItemCount: 80,
    supportedItemCount: 76,
    unsupportedItemCount: 4,
  },
  {
    categoryId: 'cat-2',
    name: 'Drinks',
    displayOrder: 2,
    totalItemCount: 130,
    supportedItemCount: 129,
    unsupportedItemCount: 1,
  },
];

const item: DeliveryChannelCategoryItem = {
  selectionKey: 'product-a::variation-1',
  providerItemId: 'provider-a',
  productId: 'product-a',
  variationId: 'variation-1',
  categoryId: 'cat-1',
  categoryName: 'Mains',
  categoryDisplayOrder: 1,
  itemDisplayOrder: 3,
  name: 'Soup',
  variationName: 'Large',
  priceMinor: 850,
  available: false,
  supported: false,
  blockReason: 'UnsupportedChoices',
};

describe('delivery channel category selection model', () => {
  it('counts whole category expansions independently of the loaded candidate page', () => {
    const selected = new Set(['cat-1', 'cat-2']);
    const override = categoryOverrideMap([
      {
        selectionKey: item.selectionKey,
        productId: item.productId,
        variationId: item.variationId,
        categoryId: item.categoryId,
        selected: false,
        supported: item.supported,
      },
    ]);

    expect(categorySelectionCount(categories, selected, override)).toBe(209);
    expect(categorySelectionState(categories[0], selected, override)).toEqual({
      selected: false,
      indeterminate: true,
      count: 79,
    });
  });

  it('preserves the explicit toggle for a category with no current items', () => {
    const emptyCategory: DeliveryChannelCategorySummary = {
      categoryId: 'empty',
      name: 'Seasonal',
      displayOrder: 3,
      totalItemCount: 0,
      supportedItemCount: 0,
      unsupportedItemCount: 0,
    };

    expect(categorySelectionState(emptyCategory, new Set(['empty']), {})).toEqual({
      selected: true,
      indeterminate: false,
      count: 0,
    });
    expect(categorySelectionState(emptyCategory, new Set(), {})).toEqual({
      selected: false,
      indeterminate: false,
      count: 0,
    });
  });

  it('sends only item overrides that differ from their category toggle', () => {
    const selected = new Set(['cat-1']);
    const overrides = categoryOverrideMap([
      {
        selectionKey: item.selectionKey,
        productId: item.productId,
        variationId: item.variationId,
        categoryId: item.categoryId,
        selected: false,
        supported: item.supported,
      },
    ]);

    expect(categoryItemIsSelected(item, selected, overrides)).toBe(false);
    expect(normalizedCategoryOverrides(selected, overrides)).toEqual([
      {
        selectionKey: item.selectionKey,
        productId: item.productId,
        variationId: item.variationId,
        categoryId: item.categoryId,
        selected: false,
        supported: item.supported,
      },
    ]);
    expect(categoryOverrideRequests(selected, overrides)).toEqual([
      {
        productId: item.productId,
        variationId: item.variationId,
        categoryId: item.categoryId,
        selected: false,
      },
    ]);
    const selectedAgain = updateCategoryItemOverride(item, true, selected, overrides);
    expect(normalizedCategoryOverrides(selected, selectedAgain)).toEqual([]);
  });

  it('does not create an item override for a candidate with no category', () => {
    const unassigned: DeliveryChannelCategoryCandidate = {
      selectionKey: 'unassigned-product:base',
      productId: 'unassigned-product',
      variationId: null,
      categoryId: null,
      categoryName: null,
      categoryDisplayOrder: null,
      itemDisplayOrder: 1,
      name: 'Unassigned product',
      variationName: null,
      priceMinor: 500,
      available: true,
      supported: false,
      blockReason: 'MissingCategory',
    };

    expect(categoryItemIsSelected(unassigned, new Set(), {})).toBe(false);
    expect(updateCategoryItemOverride(unassigned, true, new Set(), {})).toEqual({});
  });

  it('category toggles clear overrides for the expanded category without disturbing another category', () => {
    const overrides = categoryOverrideMap([
      {
        selectionKey: item.selectionKey,
        productId: item.productId,
        variationId: item.variationId,
        categoryId: 'cat-1',
        selected: false,
        supported: item.supported,
      },
      {
        selectionKey: 'drink::',
        productId: 'drink',
        variationId: null,
        categoryId: 'cat-2',
        selected: true,
        supported: true,
      },
    ]);
    const next = toggleCategorySelection('cat-1', false, new Set(['cat-1']), overrides);

    expect([...next.categoryIds]).toEqual([]);
    expect(Object.keys(next.overrides)).toEqual(['drink::']);
  });

  it('uses the frozen server blocker count for a saved draft with hidden unsupported overrides', () => {
    const selectedCategoryIds = new Set(['cat-1']);
    const overrides = categoryOverrideMap([
      {
        selectionKey: item.selectionKey,
        productId: item.productId,
        variationId: item.variationId,
        categoryId: 'cat-1',
        selected: false,
        supported: item.supported,
      },
    ]);
    const draft: DeliveryChannelCategoryDraft = {
      draftRevision: 'draft-1',
      sourceRevision: 'source-1',
      language: 'en',
      selectedCategoryIds: ['cat-1'],
      itemOverrides: normalizedCategoryOverrides(selectedCategoryIds, overrides),
      categories: [
        { ...categories[0], selectedItemCount: 79, selectedUnsupportedItemCount: 3, selectionState: 'partial' },
      ],
      items: [],
    };

    expect(categoryUnsupportedSelectionCount(categories, selectedCategoryIds, overrides, new Map(), draft)).toBe(3);
  });

  it('adjusts a saved blocker count without losing an unsupported override outside loaded pages', () => {
    const selectedCategoryIds = new Set(['cat-1']);
    const overrides = categoryOverrideMap([
      {
        selectionKey: item.selectionKey,
        productId: item.productId,
        variationId: item.variationId,
        categoryId: item.categoryId,
        selected: false,
        supported: false,
      },
    ]);
    const draft: DeliveryChannelCategoryDraft = {
      draftRevision: 'draft-1',
      sourceRevision: 'source-1',
      language: 'en',
      selectedCategoryIds: ['cat-1'],
      itemOverrides: normalizedCategoryOverrides(selectedCategoryIds, overrides),
      categories: [
        { ...categories[0], selectedItemCount: 79, selectedUnsupportedItemCount: 3, selectionState: 'partial' },
      ],
      items: [],
    };

    expect(
      categoryUnsupportedSelectionCount(categories, new Set(['cat-1', 'cat-2']), overrides, new Map(), draft),
    ).toBe(4);
  });
});
