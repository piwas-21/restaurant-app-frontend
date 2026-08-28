import {
  buildCustomizationResult,
  diffAgainstBaseRecipe,
  isInBaseRecipe,
  selectedQuantity,
  stepQuantity,
} from '../waiterSelection';
import type { DetailedIngredient, SuggestedSideItem } from '../productCustomizationTypes';

/**
 * S7 — the difference between a SELECTION and a CHANGE.
 *
 * Since the waiter sheet opens on the base recipe, "selected" no longer means "the waiter added
 * it". These rules are what stops an order line reading `Add: Cheese` for cheese the base price
 * already bought — a note the kitchen would act on and the guest sheet would never produce.
 */
const cheese: DetailedIngredient = {
  id: 'cheese',
  name: 'Cheese',
  isActive: true,
  isOptional: true,
  price: 2,
  isIncludedInBasePrice: true,
  maxQuantity: 3,
};
const bacon: DetailedIngredient = {
  id: 'bacon',
  name: 'Bacon',
  isActive: true,
  isOptional: true,
  price: 1.5,
  isIncludedInBasePrice: false,
  maxQuantity: 2,
};
const dough: DetailedIngredient = {
  id: 'dough',
  name: 'Dough',
  isActive: true,
  isOptional: false,
  price: 0,
  isIncludedInBasePrice: true,
  maxQuantity: 1,
};
const truffle: DetailedIngredient = { ...bacon, id: 'truffle', name: 'Truffle', isActive: false };

const INGREDIENTS = [dough, cheese, bacon, truffle];
const nameOf = (ingredient: DetailedIngredient) => ingredient.name;

const state = (quantities: Record<string, number>) => ({
  selectedIngredientIds: new Set(Object.keys(quantities).filter((id) => quantities[id] > 0)),
  ingredientQuantities: quantities,
});

describe('isInBaseRecipe', () => {
  it('is every required ingredient, and every optional one the base price paid for', () => {
    expect(isInBaseRecipe(dough)).toBe(true);
    expect(isInBaseRecipe(cheese)).toBe(true);
    expect(isInBaseRecipe(bacon)).toBe(false);
  });
});

describe('selectedQuantity', () => {
  it('is 0 for an unselected ingredient, whatever the quantity map still says', () => {
    expect(selectedQuantity('cheese', { selectedIngredientIds: new Set(), ingredientQuantities: { cheese: 3 } })).toBe(
      0,
    );
  });

  it('defaults a selected ingredient with no recorded quantity to one', () => {
    expect(selectedQuantity('cheese', { selectedIngredientIds: new Set(['cheese']), ingredientQuantities: {} })).toBe(
      1,
    );
  });
});

describe('stepQuantity', () => {
  it('stops at the ingredient maximum, so a control cannot offer a price the server clamps away', () => {
    expect(stepQuantity(3, 1, cheese)).toBe(3);
    expect(stepQuantity(1, 1, cheese)).toBe(2);
  });

  it('returns 0 at the bottom — a minus at one removes the ingredient, it does not dead-end', () => {
    expect(stepQuantity(1, -1, cheese)).toBe(0);
  });
});

describe('diffAgainstBaseRecipe', () => {
  it('reports nothing when the line is the base recipe', () => {
    expect(diffAgainstBaseRecipe(INGREDIENTS, state({ dough: 1, cheese: 1 }), nameOf)).toEqual({
      added: [],
      removed: [],
    });
  });

  it('calls an extra portion of a base ingredient an ADDITION, with its count', () => {
    const { added, removed } = diffAgainstBaseRecipe(INGREDIENTS, state({ dough: 1, cheese: 3 }), nameOf);

    expect(added).toEqual([{ id: 'cheese', name: 'Cheese', price: 2, quantity: 3 }]);
    expect(removed).toEqual([]);
  });

  it('calls a missing base ingredient a REMOVAL', () => {
    const { added, removed } = diffAgainstBaseRecipe(INGREDIENTS, state({ dough: 1, cheese: 0 }), nameOf);

    expect(added).toEqual([]);
    expect(removed).toEqual([{ id: 'cheese', name: 'Cheese', price: 2, quantity: 1 }]);
  });

  it('does not call an unordered paid extra a removal — nobody took it off anything', () => {
    const { removed } = diffAgainstBaseRecipe(INGREDIENTS, state({ dough: 1, cheese: 1, bacon: 0 }), nameOf);

    expect(removed).toEqual([]);
  });

  it('never reports a REQUIRED ingredient: it is removable on no surface and priced into the base', () => {
    const { added, removed } = diffAgainstBaseRecipe(INGREDIENTS, state({ cheese: 1 }), nameOf);

    expect(added.map((i) => i.id)).not.toContain('dough');
    expect(removed.map((i) => i.id)).not.toContain('dough');
  });

  it('never reports an inactive ingredient — it was not on offer', () => {
    const { added, removed } = diffAgainstBaseRecipe(INGREDIENTS, state({ dough: 1, cheese: 1, truffle: 2 }), nameOf);

    expect(added.map((i) => i.id)).not.toContain('truffle');
    expect(removed.map((i) => i.id)).not.toContain('truffle');
  });

  it('uses the localized name the sheet is showing, not the raw catalog string', () => {
    const { added } = diffAgainstBaseRecipe(INGREDIENTS, state({ bacon: 1 }), () => 'Speck');

    expect(added[0].name).toBe('Speck');
  });
});

describe('buildCustomizationResult', () => {
  const sideItems: SuggestedSideItem[] = [
    { id: 'fries', name: 'Fries', price: 4, isRequired: true, displayOrder: 1 },
    { id: 'coke', name: 'Coke', price: 2.5, isRequired: false, displayOrder: 2 },
  ];

  const build = (quantities: Record<string, number>) =>
    buildCustomizationResult({
      productId: 'p1',
      variationId: 'large',
      variationName: 'Large',
      ingredients: INGREDIENTS,
      selection: state(quantities),
      sideItems,
      selectedSideItems: new Map([['fries', 1]]),
      specialInstructions: '',
      unitPrice: 17.5,
      nameOf,
    });

  it('carries the shared price math’s unit price verbatim — it does not re-derive one', () => {
    expect(build({ dough: 1, cheese: 1 }).finalPrice).toBe(17.5);
  });

  it('splits the ingredient changes into what went on and what came off', () => {
    const result = build({ dough: 1, cheese: 0, bacon: 2 });

    expect(result.addedIngredients).toEqual([{ id: 'bacon', name: 'Bacon', price: 1.5, quantity: 2 }]);
    expect(result.removedIngredients).toEqual([{ id: 'cheese', name: 'Cheese', price: 2, quantity: 1 }]);
  });

  it('names the chosen sides from the catalog, at the chosen quantity', () => {
    expect(build({ dough: 1, cheese: 1 }).sideItems).toEqual([{ id: 'fries', name: 'Fries', quantity: 1, price: 4 }]);
  });

  it('leaves empty instructions undefined rather than sending a blank note', () => {
    expect(build({ dough: 1, cheese: 1 }).specialInstructions).toBeUndefined();
  });
});
