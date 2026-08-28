import type { ProductIngredient } from '@/types/menu';
import { moveIngredientInGroup, withNormalisedDisplayOrder } from './ingredientOrder';

/**
 * Frontend **#593** — the recipe tables had no reordering control at all after #588 removed the
 * fake drag handle, while `displayOrder` stayed a real persisted column nothing could write.
 */
const row = (id: string, kind: 'ingredient' | 'sauce', displayOrder: number): ProductIngredient =>
  ({ id, name: id, kind, displayOrder, maxQuantity: 1, price: 0, isActive: true, content: {} }) as ProductIngredient;

/** Ingredients and sauces interleaved, because that is what the one array actually looks like. */
const mixed = (): ProductIngredient[] => [
  row('tomato', 'ingredient', 0),
  row('garlic-mayo', 'sauce', 1),
  row('basil', 'ingredient', 2),
  row('chili', 'sauce', 3),
  row('mozzarella', 'ingredient', 4),
];

const idsOf = (rows: ProductIngredient[]) => rows.map((r) => r.id);
const orderOf = (rows: ProductIngredient[]) => rows.map((r) => r.displayOrder);

describe('moveIngredientInGroup', () => {
  it('moves a row within its own group', () => {
    // Ingredients are [tomato, basil, mozzarella]; move basil (index 1) up.
    const next = moveIngredientInGroup(mixed(), 'ingredient', 1, -1);

    expect(idsOf(next.filter((r) => r.kind === 'ingredient'))).toEqual(['basil', 'tomato', 'mozzarella']);
  });

  it('leaves the OTHER kind exactly where it was', () => {
    // The load-bearing one. Sauces and ingredients share a single array, so a naive index swap on
    // the whole array would drag a sauce along with an ingredient's move.
    const next = moveIngredientInGroup(mixed(), 'ingredient', 1, -1);

    expect(idsOf(next.filter((r) => r.kind === 'sauce'))).toEqual(['garlic-mayo', 'chili']);
  });

  it('renumbers displayOrder over the whole array, both kinds', () => {
    const next = moveIngredientInGroup(mixed(), 'sauce', 0, 1);

    // Contiguous 0..n-1 with no gaps and no duplicates — the state `addRow` alone never guaranteed.
    expect(orderOf(next)).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(orderOf(next)).size).toBe(next.length);
  });

  it('repairs a column that had drifted, on any move', () => {
    // Real data can hold duplicates and gaps: `addRow` stamps `ingredients.length` once and nothing
    // has ever rewritten it, so two rows added around a deletion can claim the same position.
    const drifted = [row('a', 'ingredient', 7), row('b', 'ingredient', 7), row('c', 'ingredient', 2)];

    expect(orderOf(moveIngredientInGroup(drifted, 'ingredient', 0, 1))).toEqual([0, 1, 2]);
  });

  it('returns the SAME array off either end, so an unconditional commit cannot dirty the form', () => {
    const all = mixed();

    expect(moveIngredientInGroup(all, 'ingredient', 0, -1)).toBe(all);
    expect(moveIngredientInGroup(all, 'ingredient', 2, 1)).toBe(all);
    expect(moveIngredientInGroup(all, 'ingredient', 9, -1)).toBe(all);
  });

  it('treats a row with no `kind` as an ingredient — every production row predates the field', () => {
    const legacy = [
      { id: 'old', name: 'old', displayOrder: 0, maxQuantity: 1, price: 0, content: {} },
      row('basil', 'ingredient', 1),
    ] as ProductIngredient[];

    expect(idsOf(moveIngredientInGroup(legacy, 'ingredient', 0, 1))).toEqual(['basil', 'old']);
  });
});

describe('withNormalisedDisplayOrder', () => {
  it('keeps the identity of rows it does not have to touch', () => {
    // So a repair does not mark every row changed — React and the dirty check both read identity.
    const all = mixed();
    const next = withNormalisedDisplayOrder(all);

    expect(next.every((r, i) => r === all[i])).toBe(true);
  });
});
