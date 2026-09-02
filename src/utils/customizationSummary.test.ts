import { bundleStepSummary, productStepSummary, type ProductSummaryState } from './customizationSummary';
import { buildProductSteps } from './customizationSteps';
import type { DetailedProduct, MenuSection } from '@/types/menu';

const CHEESE = {
  id: 'cheese',
  name: 'Cheese',
  price: 2,
  isOptional: true,
  isActive: true,
  isIncludedInBasePrice: true,
  maxQuantity: 3,
  displayOrder: 1,
};
const BACON = {
  id: 'bacon',
  name: 'Bacon',
  price: 3,
  isOptional: true,
  isActive: true,
  isIncludedInBasePrice: false,
  maxQuantity: 2,
  displayOrder: 2,
};
const GARLIC = { ...BACON, id: 'garlic', name: 'Garlic sauce', kind: 'sauce' as const };
const COLA = { id: 'cola', name: 'Cola', price: 3, type: 'beverage', isRequired: false, displayOrder: 1 };

const PRODUCT = {
  id: 'p1',
  name: 'Dürüm',
  basePrice: 12,
  type: 'mainItem',
  variations: [{ id: 'v1', name: 'Large', isActive: true, priceModifier: 3, displayOrder: 1 }],
  detailedIngredients: [CHEESE, BACON, GARLIC],
  suggestedSideItems: [COLA],
} as unknown as DetailedProduct;

const STEPS = buildProductSteps(PRODUCT);
const stepOf = (kind: string) => STEPS.find((step) => step.kind === kind)!;

/** The state a freshly-opened sheet has: base recipe ticked, first variation, nothing else. */
const OPENED: ProductSummaryState = {
  selectedVariationId: 'v1',
  selectedIngredients: ['cheese'],
  ingredientQuantities: { cheese: 1 },
  selectedSideItems: [],
};

describe('productStepSummary — the review is what makes a skipped step visible', () => {
  /**
   * The whole point of MENU-CUSTOMIZATION-FLOW-PLAN §3.3. An empty list is what the review renders
   * as an explicit "None" — the old collapsed disclosures left no trace at all of a group the guest
   * never opened.
   */
  it('reports NOTHING for a step the guest walked past', () => {
    expect(productStepSummary(stepOf('sauces'), PRODUCT, OPENED, 'en')).toEqual([]);
    expect(productStepSummary(stepOf('sides'), PRODUCT, OPENED, 'en')).toEqual([]);
  });

  it('reports only what CHANGED, never the whole recipe', () => {
    // Cheese arrives ticked as part of the base recipe. Listing it would bury the one real change.
    expect(productStepSummary(stepOf('ingredients'), PRODUCT, OPENED, 'en')).toEqual([]);

    const withBacon = { ...OPENED, selectedIngredients: ['cheese', 'bacon'], ingredientQuantities: { bacon: 1 } };
    expect(productStepSummary(stepOf('ingredients'), PRODUCT, withBacon, 'en')).toEqual(['Bacon']);
  });

  it('reports a removal as a removal — it is as much a choice as an addition', () => {
    const noCheese = { ...OPENED, selectedIngredients: [], ingredientQuantities: { cheese: 0 } };
    expect(productStepSummary(stepOf('ingredients'), PRODUCT, noCheese, 'en')).toEqual(['− Cheese']);
  });

  it('reports an extra helping of a base ingredient', () => {
    const doubleCheese = { ...OPENED, ingredientQuantities: { cheese: 2 } };
    expect(productStepSummary(stepOf('ingredients'), PRODUCT, doubleCheese, 'en')).toEqual(['2 × Cheese']);
  });

  it('reports chosen sauces and chosen sides with their quantities', () => {
    const chosen: ProductSummaryState = {
      ...OPENED,
      selectedIngredients: ['cheese', 'garlic'],
      selectedSideItems: [{ id: 'cola', quantity: 2 }],
    };

    expect(productStepSummary(stepOf('sauces'), PRODUCT, chosen, 'en')).toEqual(['Garlic sauce']);
    expect(productStepSummary(stepOf('sides'), PRODUCT, chosen, 'en')).toEqual(['2 × Cola']);
  });

  it('names the variation, and calls the base row an ANSWER rather than an absence', () => {
    expect(productStepSummary(stepOf('variations'), PRODUCT, OPENED, 'en')).toEqual(['Large']);
    expect(productStepSummary(stepOf('variations'), PRODUCT, { ...OPENED, selectedVariationId: null }, 'en')).toEqual([
      'Dürüm',
    ]);
  });

  it('resolves names in the guest’s own language', () => {
    const translated = {
      ...PRODUCT,
      detailedIngredients: [CHEESE, { ...BACON, content: { tr: { name: 'Pastırma' } } }, GARLIC],
    } as unknown as DetailedProduct;
    const withBacon = { ...OPENED, selectedIngredients: ['cheese', 'bacon'], ingredientQuantities: { bacon: 1 } };

    expect(productStepSummary(stepOf('ingredients'), translated, withBacon, 'tr')).toEqual(['Pastırma']);
  });
});

describe('bundleStepSummary', () => {
  const section: MenuSection = {
    id: 's1',
    name: 'Choose a drink',
    displayOrder: 1,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    items: [
      { id: 'i1', productId: 'cola', productName: 'Cola', additionalPrice: 0, displayOrder: 1, isDefault: false },
      { id: 'i2', productId: 'ayran', productName: 'Ayran', additionalPrice: 1, displayOrder: 2, isDefault: false },
    ],
  };

  it('reports the option picked, and nothing for an untouched section', () => {
    expect(bundleStepSummary(section, [])).toEqual([]);
    expect(bundleStepSummary(section, [{ sectionId: 's1', itemId: 'ayran', quantity: 1 }])).toEqual(['Ayran']);
  });
});
