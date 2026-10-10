import type {
  CustomerStepDescriptor,
  CustomerStepManifest,
  DetailedProduct,
  MenuSection,
  MenuSectionItem,
} from '@/types/menu';
import { buildCustomerProductSteps, buildMixedBundleSteps, inspectCustomerStepManifest } from './customerStepPlanner';
import { stepBlocker } from './customizationSteps';

const ingredient = (id: string, kind: 'ingredient' | 'sauce' = 'ingredient') => ({
  id,
  name: id,
  kind,
  isOptional: true,
  price: 0.5,
  maxQuantity: 1,
  isIncludedInBasePrice: false,
  isActive: true,
  displayOrder: 0,
});

const product = (overrides: Partial<DetailedProduct> = {}): DetailedProduct => ({
  id: 'product',
  name: 'Taco',
  description: '',
  basePrice: 10,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  type: 'mainItem',
  ingredients: [],
  detailedIngredients: [],
  allergens: [],
  displayOrder: 0,
  content: {},
  images: [],
  categories: [],
  variations: [],
  suggestedSideItems: [],
  ...overrides,
});

const sectionItem = (id: string, productId: string, overrides: Partial<MenuSectionItem> = {}): MenuSectionItem => ({
  id,
  productId,
  productName: productId,
  additionalPrice: 0,
  displayOrder: 0,
  isDefault: false,
  ...overrides,
});

const section = (
  id: string,
  name: string,
  displayOrder: number,
  items: MenuSectionItem[],
  required = false,
): MenuSection => ({
  id,
  name,
  displayOrder,
  isRequired: required,
  minSelection: required ? 1 : 0,
  maxSelection: 1,
  items,
});

const descriptor = (step: CustomerStepDescriptor): CustomerStepDescriptor => step;

describe('customer step planner', () => {
  it('groups shuffled stable ingredient refs into a single screen and adds review only for a multi-step path', () => {
    const taco = product({
      detailedIngredients: [ingredient('onion'), ingredient('pepper'), ingredient('hot-sauce', 'sauce')],
    });
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 4,
      steps: [
        descriptor({ kind: 'ProductSauce', targetId: 'hot-sauce', compositionRole: 'Sauce', presentationOrder: 1 }),
        descriptor({
          kind: 'ProductIngredient',
          targetId: 'pepper',
          compositionRole: 'Ingredient',
          presentationOrder: 0,
        }),
        descriptor({
          kind: 'ProductIngredient',
          targetId: 'onion',
          compositionRole: 'Ingredient',
          presentationOrder: 0,
        }),
      ],
    };

    const steps = buildCustomerProductSteps(taco, false, manifest);

    expect(steps.map((step) => step.kind)).toEqual(['ingredients', 'sauces', 'review']);
    expect(steps[0].ingredientIds).toEqual(['onion', 'pepper']);
    expect(steps[1].ingredientIds).toEqual(['hot-sauce']);
  });

  it('omits review for a real one-screen path', () => {
    const steps = buildCustomerProductSteps(product({ detailedIngredients: [ingredient('onion')] }), false, {
      schemaVersion: 1,
      revision: 1,
      steps: [
        descriptor({
          kind: 'ProductIngredient',
          targetId: 'onion',
          compositionRole: 'Ingredient',
          presentationOrder: 0,
        }),
      ],
    });

    expect(steps.map((step) => step.kind)).toEqual(['ingredients']);
  });

  it('joins a newly active variation to its compatible authored screen and validates membership', () => {
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 3,
      steps: [
        descriptor({
          kind: 'ProductVariation',
          targetId: 'regular',
          compositionRole: 'Dish',
          presentationLabel: 'Tacos',
          presentationOrder: 0,
        }),
      ],
    };
    const before = buildCustomerProductSteps(
      product({
        hideBaseProduct: true,
        variations: [
          { id: 'regular', name: 'Regular', priceModifier: 0, finalPrice: 10, isActive: true, displayOrder: 0 },
        ],
      }),
      false,
      manifest,
    );
    const after = buildCustomerProductSteps(
      product({
        hideBaseProduct: true,
        variations: [
          { id: 'regular', name: 'Regular', priceModifier: 0, finalPrice: 10, isActive: true, displayOrder: 0 },
          { id: 'large', name: 'Large', priceModifier: 2, finalPrice: 12, isActive: true, displayOrder: 1 },
        ],
      }),
      false,
      manifest,
    );

    expect(after.filter((step) => step.kind === 'variations')).toHaveLength(1);
    expect(after[0].id).toBe(before[0].id);
    expect(after[0].variationIds).toEqual(['regular', 'large']);
    expect(after[0].compositionRole).toBe('Dish');
    expect(after[0].manifestRefs?.map((ref) => ref.presentationLabel)).toEqual(['Tacos', 'Tacos']);
    expect(stepBlocker(after[0], { selectedVariationId: 'regular', selectedIngredients: [] })).toBeNull();
    expect(stepBlocker(after[0], { selectedVariationId: 'inactive', selectedIngredients: [] })).toBe('variation');
  });

  it('falls back to one picker when an old manifest split variation rows across screens', () => {
    const taco = product({
      hideBaseProduct: true,
      variations: [
        { id: 'regular', name: 'Regular', priceModifier: 0, finalPrice: 10, isActive: true, displayOrder: 0 },
        { id: 'large', name: 'Large', priceModifier: 2, finalPrice: 12, isActive: true, displayOrder: 1 },
      ],
    });
    const split: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [
        descriptor({
          kind: 'ProductVariation',
          targetId: 'regular',
          compositionRole: 'RequiredChoice',
          presentationOrder: 0,
        }),
        descriptor({
          kind: 'ProductVariation',
          targetId: 'large',
          compositionRole: 'RequiredChoice',
          presentationOrder: 1,
        }),
      ],
    };

    expect(inspectCustomerStepManifest(false, taco, [], split)).toContain('invalid-dependency-order');
    expect(buildCustomerProductSteps(taco, false, split).filter((step) => step.kind === 'variations')).toHaveLength(1);
  });

  it('allows independent ingredient rows to be authored across separate screens', () => {
    const taco = product({
      detailedIngredients: [ingredient('onion'), ingredient('pepper')],
    });
    const split: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [
        descriptor({
          kind: 'ProductIngredient',
          targetId: 'onion',
          compositionRole: 'Ingredient',
          presentationOrder: 0,
        }),
        descriptor({
          kind: 'ProductIngredient',
          targetId: 'pepper',
          compositionRole: 'Ingredient',
          presentationOrder: 1,
        }),
      ],
    };

    const steps = buildCustomerProductSteps(taco, false, split);
    expect(steps.filter((step) => step.kind === 'ingredients').map((step) => step.ingredientIds)).toEqual([
      ['onion'],
      ['pepper'],
    ]);
  });

  it('keeps global min/max sauce choices in one picker and rejects split sauce screens', () => {
    const taco = product({
      detailedIngredients: [ingredient('mild-sauce', 'sauce'), ingredient('hot-sauce', 'sauce')],
      sauceMin: 1,
      sauceMax: 1,
    });
    const partial: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [
        descriptor({ kind: 'ProductSauce', targetId: 'mild-sauce', compositionRole: 'Extra', presentationOrder: 2 }),
      ],
    };
    const completed = buildCustomerProductSteps(taco, false, partial);
    expect(completed.filter((step) => step.kind === 'sauces')).toHaveLength(1);
    const sauceStep = completed.find((step) => step.kind === 'sauces');
    expect(sauceStep?.sauceIds).toEqual(['mild-sauce', 'hot-sauce']);
    expect(sauceStep?.compositionRole).toBe('Extra');
    expect(stepBlocker(sauceStep!, { selectedVariationId: null, selectedIngredients: ['mild-sauce'] })).toBeNull();
    expect(stepBlocker(sauceStep!, { selectedVariationId: null, selectedIngredients: [] })).toBe('sauces');

    const split = {
      ...partial,
      steps: [
        ...partial.steps,
        descriptor({ kind: 'ProductSauce', targetId: 'hot-sauce', compositionRole: 'Extra', presentationOrder: 3 }),
      ],
    };
    expect(inspectCustomerStepManifest(false, taco, [], split)).toContain('invalid-dependency-order');
    expect(buildCustomerProductSteps(taco, false, split).filter((step) => step.kind === 'sauces')).toHaveLength(1);
  });

  it('joins a newly active component variation to its one authored picker', () => {
    const dish = sectionItem('dish-row', 'dish-product', {
      hideBaseProduct: true,
      variations: [
        { id: 'small', name: 'Small', priceModifier: 0, finalPrice: 10, isActive: true, displayOrder: 0 },
        { id: 'large', name: 'Large', priceModifier: 2, finalPrice: 12, isActive: true, displayOrder: 1 },
      ],
    });
    const dishes = section('dishes', 'Dishes', 0, [dish], true);
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [
        descriptor({ kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Menu', presentationOrder: 0 }),
        descriptor({
          kind: 'BundleComponentVariation',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'dish-product',
          scopeId: 'small',
          compositionRole: 'Dish',
          presentationOrder: 1,
        }),
      ],
    };
    const selected = [{ sectionId: 'dishes', itemId: 'dish-product', menuSectionItemId: 'dish-row', quantity: 1 }];

    const variationSteps = buildMixedBundleSteps([dishes], manifest, selected).filter(
      (step) => step.kind === 'variations',
    );
    expect(variationSteps).toHaveLength(1);
    expect(variationSteps[0].variationIds).toEqual(['small', 'large']);
    expect(variationSteps[0].compositionRole).toBe('Dish');
  });

  it('keeps component sauces under one min=1/max=1 picker so either sauce satisfies the rule', () => {
    const dish = sectionItem('dish-row', 'dish-product', {
      detailedIngredients: [ingredient('mild-sauce', 'sauce'), ingredient('hot-sauce', 'sauce')],
      sauceMin: 1,
      sauceMax: 1,
    });
    const dishes = section('dishes', 'Dishes', 0, [dish], true);
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [
        descriptor({ kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Menu', presentationOrder: 0 }),
        descriptor({
          kind: 'BundleComponentSauce',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'dish-product',
          scopeId: 'mild-sauce',
          compositionRole: 'Extra',
          presentationOrder: 1,
        }),
      ],
    };
    const selected = [{ sectionId: 'dishes', itemId: 'dish-product', menuSectionItemId: 'dish-row', quantity: 1 }];
    const sauceStep = buildMixedBundleSteps([dishes], manifest, selected).find((step) => step.kind === 'sauces');
    const gateOption = { ...selected[0], selectedIngredients: ['mild-sauce'] };

    expect(sauceStep?.sauceIds).toEqual(['mild-sauce', 'hot-sauce']);
    expect(
      stepBlocker(sauceStep!, { selectedVariationId: null, selectedIngredients: [], selectedOptions: [gateOption] }),
    ).toBeNull();
    expect(
      stepBlocker(sauceStep!, { selectedVariationId: null, selectedIngredients: [], selectedOptions: [selected[0]] }),
    ).toBe('sauces');
  });

  it('rejects standalone Extra screens placed before required choices and repairs the no-manifest default', () => {
    const required = {
      id: 'required-group',
      name: 'Meat',
      displayOrder: 1,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      includedFreeUnits: 0,
      isActive: true,
      content: {},
      ingredientOptions: [],
      productOptions: [],
    };
    const extra = {
      id: 'extra-group',
      name: 'Extras',
      displayOrder: 0,
      isRequired: false,
      minSelection: 0,
      maxSelection: 2,
      includedFreeUnits: 0,
      isActive: true,
      content: {},
      ingredientOptions: [],
      productOptions: [],
    };
    const taco = product({ customizationGroups: [extra, required] });
    const invalid: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [
        descriptor({
          kind: 'ProductCustomizationGroup',
          targetId: 'extra-group',
          compositionRole: 'Extra',
          presentationOrder: 0,
        }),
        descriptor({
          kind: 'ProductCustomizationGroup',
          targetId: 'required-group',
          compositionRole: 'RequiredChoice',
          presentationOrder: 1,
        }),
      ],
    };

    expect(inspectCustomerStepManifest(false, taco, [], invalid)).toContain('invalid-dependency-order');
    const defaultSteps = buildCustomerProductSteps(taco, false);
    expect(defaultSteps.filter((step) => step.kind === 'group').map((step) => step.group?.id)).toEqual([
      'required-group',
      'extra-group',
    ]);
  });

  it('puts a selected parent before its required sibling section and before optional component extras', () => {
    const dish = sectionItem('row-dish', 'prod-dish', {
      detailedIngredients: [ingredient('dish-cheese')],
      suggestedSideItems: [
        {
          id: 'side-association',
          sideItemProductId: 'side-product',
          sideItemBasePrice: 2,
          isRequired: false,
          displayOrder: 0,
        },
      ],
    });
    const meat = sectionItem('row-meat', 'prod-meat');
    const dishSection = section('section-dish', 'Tacos', 0, [dish]);
    const meatSection = section('section-meat', 'Viandes', 1, [meat], true);
    const sections = [meatSection, dishSection]; // deliberately shuffled
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 7,
      steps: [
        descriptor({
          kind: 'BundleComponentSide',
          sectionId: 'section-dish',
          sectionItemId: 'row-dish',
          productId: 'prod-dish',
          scopeId: 'side-association',
          compositionRole: 'Side',
          presentationOrder: 3,
        }),
        descriptor({
          kind: 'BundleSection',
          targetId: 'section-meat',
          parentComponentId: 'row-dish',
          compositionRole: 'RequiredChoice',
          presentationOrder: 1,
        }),
        descriptor({
          kind: 'BundleComponentIngredient',
          sectionId: 'section-dish',
          sectionItemId: 'row-dish',
          productId: 'prod-dish',
          scopeId: 'dish-cheese',
          compositionRole: 'Extra',
          presentationOrder: 2,
        }),
        descriptor({
          kind: 'BundleSection',
          targetId: 'section-dish',
          compositionRole: 'Dish',
          presentationLabel: 'Tacos',
          presentationOrder: 0,
        }),
      ],
    };
    const selected = [
      { sectionId: 'section-dish', itemId: 'prod-dish', menuSectionItemId: 'row-dish', quantity: 1 },
      { sectionId: 'section-meat', itemId: 'prod-meat', menuSectionItemId: 'row-meat', quantity: 1 },
    ];

    const steps = buildMixedBundleSteps(sections, manifest, selected);
    const dishStep = steps.find((step) => step.kind === 'section' && step.section?.id === 'section-dish');
    const meatStep = steps.find((step) => step.kind === 'section' && step.section?.id === 'section-meat');
    const extraStep = steps.find((step) => step.kind === 'ingredients' && step.component?.id === 'row-dish');

    expect(dishStep).toBeDefined();
    expect(meatStep?.parentStepId).toBe(dishStep?.id);
    expect(meatStep?.returnStepId).toBe(dishStep?.id);
    expect(steps.indexOf(meatStep!)).toBeLessThan(steps.indexOf(extraStep!));
    expect(extraStep?.ingredientIds).toEqual(['dish-cheese']);
  });

  it('rejects a dependent section whose bound owner is not authored as a Dish', () => {
    const dish = sectionItem('dish-row', 'dish-product');
    const sections = [
      section('dishes', 'Tacos', 0, [dish]),
      section('meats', 'Viandes', 1, [sectionItem('meat-row', 'meat-product')], true),
    ];
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 2,
      steps: [
        descriptor({ kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Extra', presentationOrder: 0 }),
        descriptor({
          kind: 'BundleSection',
          targetId: 'meats',
          compositionRole: 'RequiredChoice',
          parentComponentId: 'dish-row',
          presentationOrder: 1,
        }),
      ],
    };

    expect(inspectCustomerStepManifest(true, product(), sections, manifest)).toContain('invalid-dependency-order');
    expect(buildMixedBundleSteps(sections, manifest, []).map((step) => step.kind)).toEqual([
      'section',
      'section',
      'review',
    ]);
  });

  it('uses the same mixed order for legacy bundles without a saved manifest', () => {
    const optionalGroup = {
      id: 'group-extras',
      name: 'Extras',
      displayOrder: 0,
      isRequired: false,
      minSelection: 0,
      maxSelection: 2,
      includedFreeUnits: 0,
      isActive: true,
      content: {},
      ingredientOptions: [],
      productOptions: [],
    };
    const dish = sectionItem('dish-row', 'dish-product', { customizationGroups: [optionalGroup] });
    const meat = sectionItem('meat-row', 'meat-product');
    const sections = [section('dishes', 'Tacos', 0, [dish]), section('meats', 'Viandes', 1, [meat], true)];
    const steps = buildMixedBundleSteps(sections, null, [
      { sectionId: 'dishes', itemId: 'dish-product', menuSectionItemId: 'dish-row', quantity: 1 },
    ]);
    const meatIndex = steps.findIndex((step) => step.kind === 'section' && step.section?.id === 'meats');
    const extraIndex = steps.findIndex((step) => step.kind === 'group' && step.sectionItemId === 'dish-row');

    expect(steps[0].kind).toBe('section');
    expect(meatIndex).toBeGreaterThanOrEqual(0);
    expect(extraIndex).toBeGreaterThan(meatIndex);
    expect(steps[steps.length - 1].kind).toBe('review');
  });

  it('resolves repeated product choices by menu-section row id and drops the dependent screen after deselection', () => {
    const first = sectionItem('row-a', 'same-product', {
      suggestedSideItems: [
        { id: 'side-a', sideItemProductId: 'cola-a', sideItemBasePrice: 2, isRequired: false, displayOrder: 0 },
      ],
    });
    const second = sectionItem('row-b', 'same-product', {
      suggestedSideItems: [
        { id: 'side-b', sideItemProductId: 'cola-b', sideItemBasePrice: 3, isRequired: false, displayOrder: 0 },
      ],
    });
    const menuSection = section('section', 'Choices', 0, [first, second]);
    menuSection.maxSelection = 2;
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 2,
      steps: [
        descriptor({ kind: 'BundleSection', targetId: 'section', compositionRole: 'Menu', presentationOrder: 0 }),
        descriptor({
          kind: 'BundleComponentSide',
          sectionId: 'section',
          sectionItemId: 'row-a',
          productId: 'same-product',
          scopeId: 'side-a',
          compositionRole: 'Side',
          presentationOrder: 1,
        }),
        descriptor({
          kind: 'BundleComponentSide',
          sectionId: 'section',
          sectionItemId: 'row-b',
          productId: 'same-product',
          scopeId: 'side-b',
          compositionRole: 'Side',
          presentationOrder: 2,
        }),
      ],
    };
    const rowBSelection = [{ sectionId: 'section', itemId: 'same-product', menuSectionItemId: 'row-b', quantity: 1 }];

    const selectedSteps = buildMixedBundleSteps([menuSection], manifest, rowBSelection);
    const sideStep = selectedSteps.find((step) => step.kind === 'sides');
    const deselectedSteps = buildMixedBundleSteps([menuSection], manifest, []);

    expect(sideStep?.component?.id).toBe('row-b');
    expect(sideStep?.sideItemIds).toEqual(['side-b']);
    expect(deselectedSteps.map((step) => step.kind)).toEqual(['section']);
  });
});
