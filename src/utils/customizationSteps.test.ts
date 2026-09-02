import { buildBundleSteps, buildProductSteps, offersGenericDrinks, stepBlocker } from './customizationSteps';
import type { DetailedProduct, MenuSection } from '@/types/menu';

const ingredient = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  price: 1,
  isOptional: true,
  isActive: true,
  displayOrder: 1,
  ...overrides,
});

const product = (overrides: Partial<DetailedProduct> = {}): DetailedProduct =>
  ({
    id: 'p1',
    name: 'Dürüm',
    basePrice: 12,
    type: 'mainItem',
    variations: [],
    detailedIngredients: [],
    suggestedSideItems: [],
    ...overrides,
  }) as unknown as DetailedProduct;

const section = (overrides: Partial<MenuSection> = {}): MenuSection => ({
  id: 's1',
  name: 'Choose a drink',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [],
  ...overrides,
});

describe('buildProductSteps — the flow is DERIVED, so a simple item stays simple', () => {
  /**
   * The load-bearing rule of the whole redesign (MENU-CUSTOMIZATION-FLOW-PLAN §2). If a
   * one-decision item grew a stepper, every simple order would pay for the complex ones.
   */
  it('gives a one-decision item exactly one step and NO review', () => {
    const steps = buildProductSteps(product({ variations: [{ id: 'v1', name: 'Large', isActive: true } as never] }));

    expect(steps.map((step) => step.kind)).toEqual(['variations']);
  });

  it('appends the review step as soon as there are two decisions', () => {
    const steps = buildProductSteps(
      product({
        variations: [{ id: 'v1', name: 'Large', isActive: true } as never],
        detailedIngredients: [ingredient('cheese')],
      }),
    );

    expect(steps.map((step) => step.kind)).toEqual(['variations', 'ingredients', 'review']);
  });

  it('renders nothing at all for an item with no decisions', () => {
    expect(buildProductSteps(product())).toEqual([]);
  });

  /**
   * Sauces used to be a collapsed disclosure INSIDE the ingredient block. Splitting them is the
   * point; this pins that they are two steps and not one, which is what stops the ingredient step
   * mounting the group a second time.
   */
  it('separates sauces from the other ingredients', () => {
    const steps = buildProductSteps(
      product({
        detailedIngredients: [ingredient('cheese'), ingredient('garlic', { kind: 'sauce' })],
      }),
    );

    expect(steps.map((step) => step.kind)).toEqual(['ingredients', 'sauces', 'review']);
  });

  /**
   * ONE step over the partitions, not one each: three side steps on top of variations, ingredients
   * and sauces reached seven, and "differently long" is not an answer to "too complicated".
   */
  it('gives every suggested-side partition ONE shared step', () => {
    const steps = buildProductSteps(
      product({
        variations: [{ id: 'v1', name: 'Large', isActive: true } as never],
        suggestedSideItems: [
          { id: 'cola', name: 'Cola', price: 3, type: 'beverage', isRequired: false, displayOrder: 1 } as never,
          { id: 'cake', name: 'Cake', price: 5, type: 'dessert', isRequired: false, displayOrder: 2 } as never,
          { id: 'fries', name: 'Fries', price: 5, type: 'sideItem', isRequired: false, displayOrder: 3 } as never,
        ],
      }),
    );

    // Three partitions, one step. Before this it was `sides:beverages`, `sides:desserts`,
    // `sides:accompaniments` — three of the seven a fully-configured dish reached.
    expect(steps.map((step) => step.id)).toEqual(['variations', 'sides', 'review']);
    // …and it is titled for the whole group, not for whichever partition happened to be first.
    expect(steps[1].titleKey).toBe('step_sides');
  });

  it('marks the variations step required only when the base row is withheld', () => {
    const variations = [{ id: 'v1', name: 'Large', isActive: true } as never];

    expect(buildProductSteps(product({ variations }))[0].isRequired).toBe(false);
    expect(buildProductSteps(product({ variations, hideBaseProduct: true }))[0].isRequired).toBe(true);
  });

  it('takes the sauce step’s requirement and widget from the product’s own rule', () => {
    const sauces = [ingredient('garlic', { kind: 'sauce' })];

    const optional = buildProductSteps(product({ detailedIngredients: sauces }))[0];
    expect(optional).toMatchObject({ kind: 'sauces', isRequired: false, singleChoice: false });

    const single = buildProductSteps(
      product({ detailedIngredients: sauces, sauceMin: 1, sauceMax: 1 } as Partial<DetailedProduct>),
    )[0];
    expect(single).toMatchObject({ kind: 'sauces', isRequired: true, singleChoice: true });
  });
});

describe('buildBundleSteps', () => {
  it('gives each menu section its own step, carrying the tenant’s own section name', () => {
    const steps = buildBundleSteps([section(), section({ id: 's2', name: 'Choose a side', isRequired: false })]);

    expect(steps.map((step) => step.title)).toEqual(['Choose a drink', 'Choose a side', undefined]);
    expect(steps.map((step) => step.isRequired)).toEqual([true, false, false]);
  });

  it('leaves a single-section combo without a review step', () => {
    expect(buildBundleSteps([section()]).map((step) => step.kind)).toEqual(['section']);
  });

  /**
   * A combo's composition is the tenant's design and usually already includes a drink; there is
   * also no way to tell — `MenuSectionItem` carries no `ProductType` — so offering one would be a
   * guess whose wrong answer is the common case.
   */
  it('never adds a generic drinks step to a combo', () => {
    const steps = buildBundleSteps([section(), section({ id: 's2', name: 'Pick a side' })]);
    expect(steps.map((step) => step.kind)).not.toContain('drinks');
  });
});

describe('offersGenericDrinks — the admin’s curation wins where it exists', () => {
  it('offers drinks for an ordinary dish with no beverage sides of its own', () => {
    expect(offersGenericDrinks(product())).toBe(true);
  });

  it('refuses for a product that already curates a beverages group', () => {
    expect(
      offersGenericDrinks(
        product({
          suggestedSideItems: [
            { id: 'cola', name: 'Cola', price: 3, type: 'beverage', isRequired: false, displayOrder: 1 } as never,
          ],
        }),
      ),
    ).toBe(false);
  });

  it('refuses for a drink — a beverage does not upsell itself', () => {
    expect(offersGenericDrinks(product({ type: 'beverage' }))).toBe(false);
  });
});

describe('stepBlocker — the gate reads the same rules the Add button enforces', () => {
  const empty = { selectedVariationId: null, selectedIngredients: [] };

  it('never blocks an optional step', () => {
    const step = buildProductSteps(product({ detailedIngredients: [ingredient('cheese')] }))[0];
    expect(stepBlocker(step, empty)).toBeNull();
  });

  it('blocks a required variations step until something is picked, and clears on the pick', () => {
    const step = buildProductSteps(
      product({ variations: [{ id: 'v1', name: 'Large', isActive: true } as never], hideBaseProduct: true }),
    )[0];

    expect(stepBlocker(step, empty)).toBe('variation');
    expect(stepBlocker(step, { ...empty, selectedVariationId: 'v1' })).toBeNull();
  });

  it('blocks a sauce step below its minimum and clears at it', () => {
    const step = buildProductSteps(
      product({
        detailedIngredients: [ingredient('garlic', { kind: 'sauce' }), ingredient('chilli', { kind: 'sauce' })],
        sauceMin: 2,
      } as Partial<DetailedProduct>),
    )[0];

    expect(stepBlocker(step, empty, 2, ['garlic', 'chilli'])).toBe('sauces');
    expect(stepBlocker(step, { ...empty, selectedIngredients: ['garlic'] }, 2, ['garlic', 'chilli'])).toBe('sauces');
    expect(
      stepBlocker(step, { ...empty, selectedIngredients: ['garlic', 'chilli'] }, 2, ['garlic', 'chilli']),
    ).toBeNull();
  });

  it('blocks a required bundle section with nothing chosen', () => {
    const step = buildBundleSteps([section()])[0];

    expect(stepBlocker(step, empty)).toBe('section');
    expect(
      stepBlocker(step, { ...empty, selectedOptions: [{ sectionId: 's1', itemId: 'i1', quantity: 1 }] }),
    ).toBeNull();
  });
});
