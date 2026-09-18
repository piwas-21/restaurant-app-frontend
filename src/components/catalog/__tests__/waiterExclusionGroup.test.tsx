import { act, renderHook } from '@testing-library/react';
import useWaiterIngredientSelection from '../useWaiterIngredientSelection';
import type { DetailedIngredient } from '../productCustomizationTypes';

/**
 * Waiter-sheet parity for mutual exclusion (SHARED-MODIFIERS-AND-SAUCES-PLAN §9, slice X3).
 *
 * This is not optional polish. `POST /api/Orders` honours a staff-declared unit price
 * (`OrderItemFactory`, `pricesAreTrusted = itemsAreServerPriced || IsStaff`), so a till that let
 * both members of an exclusion group onto one line would CHARGE for both and print a kitchen ticket
 * that asks for two answers to one question. S7 exists because the two sheets asked one question
 * twice and drifted; shipping this rule on the guest side only would re-open that seam.
 *
 * The hook is driven through its own API — seed, then toggle — so a state the rule can describe and
 * the sheet cannot reach would fail.
 */
const ingredient = (over: Partial<DetailedIngredient> & { id: string }): DetailedIngredient => ({
  name: over.id,
  isActive: true,
  isOptional: true,
  price: 0,
  maxQuantity: 1,
  displayOrder: 0,
  ...over,
});

const recipe: DetailedIngredient[] = [
  ingredient({ id: 'rare', exclusionGroup: 'doneness' }),
  ingredient({ id: 'well', exclusionGroup: 'doneness' }),
  ingredient({ id: 'bacon', price: 3 }),
];

function seeded(ingredients: DetailedIngredient[] = recipe) {
  const hook = renderHook(() => useWaiterIngredientSelection());
  act(() => hook.result.current.seedFromBaseRecipe(ingredients));
  return hook;
}

describe('useWaiterIngredientSelection — exclusion groups', () => {
  it('switches the sibling off when the other member is chosen', () => {
    const { result } = seeded();

    act(() => result.current.toggleIngredient(recipe[0]));
    act(() => result.current.toggleIngredient(recipe[1]));

    expect([...result.current.selectedIngredients]).toEqual(['well']);
    // The dropped sibling keeps an explicit 0 rather than being merely absent, so the removal
    // survives into the payload exactly as a de-selection does (issue #150).
    expect(result.current.ingredientQuantities.rare).toBe(0);
    expect(result.current.ingredientQuantities.well).toBe(1);
  });

  it('leaves an ungrouped ingredient alone', () => {
    const { result } = seeded();

    act(() => result.current.toggleIngredient(recipe[0]));
    act(() => result.current.toggleIngredient(recipe[2]));

    expect([...result.current.selectedIngredients].sort()).toEqual(['bacon', 'rare']);
  });

  it('still un-ticks a chosen member, so the waiter can end with no answer', () => {
    const { result } = seeded();

    act(() => result.current.toggleIngredient(recipe[0]));
    act(() => result.current.toggleIngredient(recipe[0]));

    expect([...result.current.selectedIngredients]).toEqual([]);
    expect(result.current.ingredientQuantities.rare).toBe(0);
  });

  // The seed is what teaches the hook the recipe. A member the base price already paid for opens
  // SELECTED, and choosing the other one must take it off — the "comes medium, change it" shape the
  // server allows for exactly one member of a group.
  it('drops an included-in-base member the sheet opened on', () => {
    const withDefault: DetailedIngredient[] = [
      ingredient({ id: 'rare', exclusionGroup: 'doneness', isIncludedInBasePrice: true, price: 2 }),
      ingredient({ id: 'well', exclusionGroup: 'doneness', price: 2 }),
    ];
    const { result } = seeded(withDefault);

    expect([...result.current.selectedIngredients]).toEqual(['rare']);

    act(() => result.current.toggleIngredient(withDefault[1]));

    expect([...result.current.selectedIngredients]).toEqual(['well']);
    expect(result.current.ingredientQuantities.rare).toBe(0);
  });
});
