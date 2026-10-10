import { bundleComponentStepSummary } from './bundleComponentSummary';
import type { CustomizationStep } from './customizationSteps';
import type { MenuSectionItem, SelectedMenuOption } from '@/types/menu';

const item: MenuSectionItem = {
  id: 'row-a',
  productId: 'burger',
  productName: 'Burger',
  additionalPrice: 0,
  displayOrder: 1,
  isDefault: true,
  sauceMin: 0,
  sauceMax: 1,
  sauceIncludedFree: 1,
  variations: [
    { id: 'regular', name: 'Regular', priceModifier: 0, finalPrice: 18, isActive: true, displayOrder: 1 },
    {
      id: 'large',
      name: 'Large',
      priceModifier: 2,
      finalPrice: 20,
      isActive: true,
      displayOrder: 2,
      content: { fr: { name: 'Grand' } },
    },
  ],
  detailedIngredients: [
    {
      id: 'lettuce',
      name: 'Lettuce',
      content: { fr: { name: 'Laitue' } },
      price: 0,
      isOptional: false,
      isIncludedInBasePrice: true,
      isActive: true,
      displayOrder: 1,
      maxQuantity: 1,
    },
    {
      id: 'cheese',
      name: 'Cheese',
      price: 2,
      isOptional: true,
      isIncludedInBasePrice: false,
      isActive: true,
      displayOrder: 2,
      maxQuantity: 1,
    },
    {
      id: 'ketchup',
      name: 'Ketchup',
      price: 1,
      isOptional: true,
      isIncludedInBasePrice: false,
      isActive: true,
      displayOrder: 3,
      maxQuantity: 1,
      kind: 'sauce',
    },
  ],
};

const option = (rowId: string, selectedIngredients: string[], variationId?: string): SelectedMenuOption => ({
  sectionId: 'main',
  itemId: 'burger',
  menuSectionItemId: rowId,
  componentProductVariationId: variationId,
  quantity: 1,
  selectedIngredients,
  ingredientQuantities: Object.fromEntries(selectedIngredients.map((id) => [id, 1])),
});

const step = (kind: CustomizationStep['kind'], overrides: Partial<CustomizationStep> = {}): CustomizationStep => ({
  id: `component-${kind}`,
  kind,
  singleChoice: false,
  isRequired: false,
  component: item,
  sectionItemId: item.id,
  ...overrides,
});

describe('bundleComponentStepSummary', () => {
  it('summarizes the exact component choices, including its base recipe, with localized names', () => {
    const selected = option('row-a', ['lettuce', 'cheese', 'ketchup'], 'large');

    expect(bundleComponentStepSummary(step('variations'), [selected], 'fr', 'Sans sauce')).toEqual(['Grand']);
    expect(
      bundleComponentStepSummary(
        step('ingredients', { ingredientIds: ['lettuce', 'cheese'] }),
        [selected],
        'fr',
        'Sans sauce',
      ),
    ).toEqual(['Laitue', 'Cheese']);
    expect(bundleComponentStepSummary(step('sauces', { sauceIds: ['ketchup'] }), [selected], 'en', 'No sauce')).toEqual(
      ['Ketchup'],
    );
  });

  it('keeps duplicate-product selections scoped to the stable section item row', () => {
    const first = option('row-a', ['lettuce', 'cheese', 'ketchup'], 'large');
    const second = option('row-b', ['lettuce'], 'regular');

    expect(
      bundleComponentStepSummary(
        step('ingredients', { ingredientIds: ['lettuce', 'cheese'] }),
        [second, first],
        'en',
        'No sauce',
      ),
    ).toEqual(['Lettuce', 'Cheese']);
    expect(
      bundleComponentStepSummary(
        step('variations', { sectionItemId: 'row-b', component: { ...item, id: 'row-b' } }),
        [second, first],
        'en',
        'No sauce',
      ),
    ).toEqual(['Regular']);
  });

  it('states the no-sauce answer separately from an empty optional ingredient step', () => {
    const selected = option('row-a', [], 'regular');

    expect(bundleComponentStepSummary(step('sauces', { sauceIds: ['ketchup'] }), [selected], 'en', 'No sauce')).toEqual(
      ['No sauce'],
    );
    expect(
      bundleComponentStepSummary(step('ingredients', { ingredientIds: ['cheese'] }), [selected], 'en', 'No sauce'),
    ).toEqual([]);
  });

  it('does not infer a selection from another row with the same product id', () => {
    const otherRow = option('row-b', ['lettuce', 'cheese'], 'large');

    expect(bundleComponentStepSummary(step('variations'), [otherRow], 'en', 'No sauce')).toEqual([]);
  });
});
