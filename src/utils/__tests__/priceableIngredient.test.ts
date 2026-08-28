import {
  DEFAULT_INGREDIENT_QUANTITY,
  maxIngredientQuantity,
  toPriceableIngredients,
  type IngredientPricingFields,
  type PriceableIngredientRow,
} from '../priceableIngredient';

/**
 * The input contract of the ONE price math. Its whole job is that a sheet cannot quietly drop a
 * field the server prices on — which is exactly how the waiter sheet came to charge for an
 * ingredient the base price had already bought (S7).
 */
describe('toPriceableIngredients', () => {
  it('carries every field the price math reads', () => {
    expect(
      toPriceableIngredients([
        { id: 'a', price: 2, isOptional: true, isActive: true, isIncludedInBasePrice: true, maxQuantity: 3 },
      ]),
    ).toEqual([{ id: 'a', price: 2, isOptional: true, isActive: true, isIncludedInBasePrice: true, maxQuantity: 3 }]);
  });

  it('reads a missing price as free, never as NaN', () => {
    expect(toPriceableIngredients([{ id: 'a', isOptional: true, isActive: true }])[0].price).toBe(0);
  });

  it('filters nothing — the price math owns the required/inactive rule, and owns it once', () => {
    const rows = toPriceableIngredients([
      { id: 'required', price: 1, isOptional: false, isActive: true },
      { id: 'inactive', price: 1, isOptional: true, isActive: false },
    ]);

    expect(rows.map((r) => r.id)).toEqual(['required', 'inactive']);
  });

  it('answers an empty list for nothing at all', () => {
    expect(toPriceableIngredients(undefined)).toEqual([]);
  });
});

describe('maxIngredientQuantity', () => {
  it('mirrors the price math’s own default, so no control can offer a clamped-away quantity', () => {
    expect(maxIngredientQuantity({})).toBe(DEFAULT_INGREDIENT_QUANTITY);
    expect(maxIngredientQuantity({ maxQuantity: 4 })).toBe(4);
  });
});

/**
 * The gate that matters more than any single field.
 *
 * This bridge's failure mode is a SILENT DROP: add a field to the price math's input, forget to map
 * it here, and there is no type error (the projection is a fresh object literal), no failing test,
 * and no exception — just a different number on one of the two sheets. That is how
 * `isIncludedInBasePrice` and `maxQuantity` went missing from the waiter sheet in the first place,
 * and how the sauce group's `kind` would go missing next.
 *
 * So the contract is enforced twice, on both axes:
 *   - at COMPILE time, that the output type has a home for every input field;
 *   - at RUN time, over a fixture that is `Record<keyof IngredientPricingFields, …>` — so adding a
 *     field to the interface breaks this file until somebody carries it — that every one of those
 *     keys survives the projection with its value intact.
 */
describe('the projection is exhaustive', () => {
  // Compile-time: `never` iff every field of the input has a key in the output. Adding a field to
  // `IngredientPricingFields` and not to `PriceableIngredientRow` fails `tsc --noEmit`, in CI and
  // in the pre-commit hook, before any test runs.
  //
  // It is a CONSTRAINT, not an annotated empty array: `const x: 'foo'[] = []` compiles happily and
  // would have proved nothing. `Assert<T extends never>` is the form that actually goes red.
  type Assert<T extends never> = T;
  type FieldsWithNoHomeInTheProjection = Exclude<keyof IngredientPricingFields, keyof PriceableIngredientRow>;
  type _EveryFieldHasAHome = Assert<FieldsWithNoHomeInTheProjection>;

  // Run-time: every key, with a value chosen so a mix-up is visible.
  const everyField: Required<IngredientPricingFields> = {
    id: 'sriracha',
    price: 0.5,
    isOptional: true,
    isActive: true,
    isIncludedInBasePrice: false,
    maxQuantity: 2,
    kind: 'sauce',
    displayOrder: 7,
  };

  it('carries every field of the input, by name and by value', () => {
    const [projected] = toPriceableIngredients([everyField]);

    for (const key of Object.keys(everyField) as Array<keyof PriceableIngredientRow>) {
      expect(projected).toHaveProperty(key);
      expect(projected[key]).toEqual(everyField[key as keyof typeof everyField]);
    }
  });

  it('adds nothing of its own — the bridge translates, it does not decide', () => {
    const [projected] = toPriceableIngredients([everyField]);

    expect(Object.keys(projected).sort()).toEqual(Object.keys(everyField).sort());
  });

  it('leaves the sauce-group fields undefined rather than guessing them', () => {
    // `undefined` already means "an ordinary ingredient" and "no order". A default here would be a
    // second opinion about a rule that belongs to `utils/sauceGroup.ts` (#596).
    const [projected] = toPriceableIngredients([{ id: 'a', isOptional: true, isActive: true }]);

    expect(projected.kind).toBeUndefined();
    expect(projected.displayOrder).toBeUndefined();
  });
});
