import { act, renderHook } from '@testing-library/react';
import { useMenuFilters, SPECIAL_FILTER_ID, type FilterableItem } from './useMenuFilters';

/**
 * The menu's dietary / allergen filter chips.
 *
 * Two of these assertions are the reason the feature is worth having at all rather than being a
 * cosmetic row of pills, and they are the two a "just filter the tags" implementation gets wrong:
 * an allergen chip EXCLUDES, and multiple chips are ANDed. A guest ticking "No nuts" and "No milk"
 * and being shown a dish with nuts in it because the predicate ORed is not a UI bug.
 */

const dish = (name: string, allergens: string[] = [], isSpecial = false): FilterableItem & { name: string } => ({
  name,
  allergens,
  isSpecial,
});

const MENU = [
  dish('Beyti', ['halal', 'gluten', 'milk']),
  dish('Salad', ['vegan', 'gluten_free']),
  dish('Baklava', ['vegetarian', 'nuts', 'milk'], true),
  dish('Ayran', ['halal', 'milk']),
  dish('Plain rice'),
];

const idsOf = (options: { id: string }[]) => options.map((o) => o.id);
const namesOf = (items: { name: string }[]) => items.map((i) => i.name);

describe('useMenuFilters — the options it offers', () => {
  it('derives its chips from the dishes on screen, never from a fixed vocabulary', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    // Nothing on this menu is `kosher` or `spicy`, so neither is offered — a chip that can only
    // ever return an empty menu is worse than no chip.
    expect(idsOf(result.current.options)).not.toContain('claim:kosher');
    expect(idsOf(result.current.options)).toEqual(
      expect.arrayContaining([SPECIAL_FILTER_ID, 'claim:halal', 'claim:vegan', 'without:milk', 'without:nuts']),
    );
  });

  it('collapses an aliased spelling into ONE chip', () => {
    // `dairy` and `lactose` are `milk`. Three chips for one substance would let a guest avoiding
    // milk tick one of them and still be served the other two dishes.
    const { result } = renderHook(() =>
      useMenuFilters([dish('a', ['dairy']), dish('b', ['lactose']), dish('c', ['milk'])]),
    );

    expect(idsOf(result.current.options).filter((id) => id.endsWith(':milk'))).toEqual(['without:milk']);
    expect(result.current.options.find((o) => o.id === 'without:milk')?.count).toBe(0);
  });

  it('counts an exclusion chip by what SURVIVES it, not by what carries the substance', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    // 3 of 5 dishes carry milk, so "No milk" leaves 2. Counting the other way round would put "3"
    // beside a chip that shows 2 dishes — the mistake that makes an exclusion read as a warning.
    expect(result.current.options.find((o) => o.id === 'without:milk')?.count).toBe(2);
    expect(result.current.options.find((o) => o.id === 'claim:halal')?.count).toBe(2);
    expect(result.current.options.find((o) => o.id === SPECIAL_FILTER_ID)?.count).toBe(1);
  });

  it('ignores a token in neither vocabulary, and an item with no allergen field at all', () => {
    // A tenant can type anything into the allergen list. An unrecognised word must not become a
    // chip — it has no include/exclude meaning, so either treatment would be a guess — and an item
    // whose `allergens` key is simply absent must not throw on the way past.
    const { result } = renderHook(() =>
      useMenuFilters([{ allergens: ['unicorn', 'halal'] }, { isSpecial: false }, {}]),
    );

    expect(idsOf(result.current.options)).toEqual(['claim:halal']);
    expect(result.current.filtered).toHaveLength(3);
  });

  it('offers no specials chip on a menu with no specials', () => {
    const { result } = renderHook(() => useMenuFilters([dish('a', ['halal'])]));
    expect(idsOf(result.current.options)).not.toContain(SPECIAL_FILTER_ID);
  });
});

describe('useMenuFilters — counts are LIVE', () => {
  /**
   * The reported "filters don't work properly", and it was never the predicate.
   *
   * On a menu where the one Halal dish also contains gluten, static counts read "Halal 1" beside
   * "No gluten 2" — which looks like the pair should yield something. It yields nothing, correctly,
   * and there was no way to see that before pressing. A live count says 0 first.
   */
  it('recomputes each chip against the chips already on', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));
    const countOf = (id: string) => result.current.options.find((o) => o.id === id)?.count;

    expect(countOf('claim:halal')).toBe(2);
    expect(countOf('without:milk')).toBe(2);

    act(() => result.current.toggle('claim:halal'));

    // Both Halal dishes contain milk, so "No milk" on top of "Halal" would empty the menu — and
    // the chip says so rather than looking like it would leave 2.
    expect(countOf('without:milk')).toBe(0);
    // The pressed chip keeps reporting what it is currently showing.
    expect(countOf('claim:halal')).toBe(2);
  });

  it('does not reshuffle the chips as counts change', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));
    const order = () => result.current.options.map((o) => o.id);
    const before = order();

    act(() => result.current.toggle('claim:halal'));

    // Ordered by how common the TAG is, which is stable data. Ordering by the live count would move
    // chips under the guest's finger every time one was pressed.
    expect(order()).toEqual(before);
  });
});

describe('useMenuFilters — what it filters', () => {
  it('shows everything until a chip is pressed', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));
    expect(namesOf(result.current.filtered)).toEqual(['Beyti', 'Salad', 'Baklava', 'Ayran', 'Plain rice']);
  });

  it('an allergen chip EXCLUDES — it does not show the dishes that contain it', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    act(() => result.current.toggle('without:milk'));

    expect(namesOf(result.current.filtered)).toEqual(['Salad', 'Plain rice']);
  });

  it('a dietary chip INCLUDES', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    act(() => result.current.toggle('claim:halal'));

    expect(namesOf(result.current.filtered)).toEqual(['Beyti', 'Ayran']);
  });

  it('ANDs across chips — the OR reading is the dangerous one', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    act(() => result.current.toggle('without:milk'));
    act(() => result.current.toggle('without:nuts'));

    // ORed, "No milk" alone would satisfy Baklava and a guest avoiding nuts would be shown it.
    expect(namesOf(result.current.filtered)).toEqual(['Salad', 'Plain rice']);
    expect(namesOf(result.current.filtered)).not.toContain('Baklava');
  });

  it('an alias in the DATA is excluded by the canonical chip', () => {
    const menu = [dish('Latte', ['dairy']), dish('Espresso')];
    const { result } = renderHook(() => useMenuFilters(menu));

    act(() => result.current.toggle('without:milk'));

    expect(namesOf(result.current.filtered)).toEqual(['Espresso']);
  });

  it('toggles off, and clears', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    act(() => result.current.toggle('claim:halal'));
    act(() => result.current.toggle('claim:halal'));
    expect(result.current.filtered).toHaveLength(5);

    act(() => result.current.toggle('claim:halal'));
    act(() => result.current.clear());
    expect(result.current.filtered).toHaveLength(5);
    expect(result.current.activeIds.size).toBe(0);
  });
});

describe('useMenuFilters — a chip the new category cannot offer', () => {
  /**
   * The failure this prevents is silent: a chip pressed in one category, carried into another that
   * has no dish tagged that way, filtering everything out — with no lit chip anywhere on screen to
   * explain the empty menu, because the chip is not in the new category's option list either.
   */
  it('stops filtering by a chip it no longer offers, rather than emptying the menu', () => {
    const { result, rerender } = renderHook(({ items }) => useMenuFilters(items), {
      initialProps: { items: MENU },
    });

    act(() => result.current.toggle('claim:vegan'));
    expect(namesOf(result.current.filtered)).toEqual(['Salad']);

    // A category with nothing vegan in it.
    rerender({ items: [dish('Kebab', ['halal']), dish('Lahmacun', ['halal'])] });

    expect(idsOf(result.current.options)).not.toContain('claim:vegan');
    expect(result.current.activeIds.size).toBe(0);
    expect(namesOf(result.current.filtered)).toEqual(['Kebab', 'Lahmacun']);
  });

  it('keeps the intent where the new category CAN honour it', () => {
    const { result, rerender } = renderHook(({ items }) => useMenuFilters(items), {
      initialProps: { items: MENU },
    });

    act(() => result.current.toggle('claim:halal'));
    rerender({ items: [dish('Kebab', ['halal']), dish('Salad', ['vegan'])] });

    expect(result.current.activeIds.has('claim:halal')).toBe(true);
    expect(namesOf(result.current.filtered)).toEqual(['Kebab']);
  });
});

describe('useMenuFilters — specials', () => {
  it('shows only the promoted dishes', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    act(() => result.current.toggle(SPECIAL_FILTER_ID));

    expect(namesOf(result.current.filtered)).toEqual(['Baklava']);
  });

  it('combines with an allergen chip like any other', () => {
    const { result } = renderHook(() => useMenuFilters(MENU));

    act(() => result.current.toggle(SPECIAL_FILTER_ID));
    act(() => result.current.toggle('without:nuts'));

    // The only special has nuts in it.
    expect(result.current.filtered).toEqual([]);
  });
});
