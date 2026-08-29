import {
  UNCATEGORISED_GROUP_ID,
  buildApplyPlan,
  groupProductsByCategory,
  groupSelectionState,
  toggleGroup,
  type ApplyTargetProduct,
} from './libraryApplyTargets';

/**
 * Slice S8's arithmetic — "apply one library row to 40 pizzas" and the blast-radius confirm (D6).
 *
 * Every oracle below is computed BY HAND from the fixture, and the fixture is built so the two
 * shapes that make a naive implementation wrong are both present: a product in TWO categories
 * (Margherita, in Pizzas and in Lunch) and a product that already carries the row (Quattro). A
 * fixture with neither cannot fail against counting ticks instead of products.
 */

const PRODUCTS: ApplyTargetProduct[] = [
  {
    id: 'margherita',
    name: 'Margherita',
    categories: [
      { categoryId: 'pizzas', categoryName: 'Pizzas' },
      { categoryId: 'lunch', categoryName: 'Lunch' },
    ],
  },
  { id: 'quattro', name: 'Quattro Stagioni', categories: [{ categoryId: 'pizzas', categoryName: 'Pizzas' }] },
  { id: 'diavola', name: 'Diavola', categories: [{ categoryId: 'pizzas', categoryName: 'Pizzas' }] },
  { id: 'tiramisu', name: 'Tiramisu', categories: [{ categoryId: 'desserts', categoryName: 'Desserts' }] },
  { id: 'water', name: 'Still water' },
];

const groups = () => groupProductsByCategory(PRODUCTS, 'No category');
const groupNamed = (id: string) => groups().find((group) => group.categoryId === id)!;

describe('groupProductsByCategory', () => {
  it('lists a product under EVERY category that claims it', () => {
    // Margherita is in two, so the group sizes sum to 6 while there are only 5 products. That gap
    // is the whole reason the counting functions cannot count ticks.
    expect(groupNamed('pizzas').productIds).toEqual(['margherita', 'quattro', 'diavola']);
    expect(groupNamed('lunch').productIds).toEqual(['margherita']);
    expect(groups().reduce((total, group) => total + group.productIds.length, 0)).toBe(6);
    expect(PRODUCTS).toHaveLength(5);
  });

  it('gives a product with no category a real group rather than dropping it', () => {
    const remainder = groupNamed(UNCATEGORISED_GROUP_ID);

    expect(remainder.productIds).toEqual(['water']);
    expect(remainder.categoryName).toBe('No category');
  });

  it('orders categories by name and always puts the remainder last', () => {
    // Alphabetically "No category" would sort between Lunch and Pizzas; it must not, or the group
    // would move position from one locale to the next.
    expect(groups().map((group) => group.categoryId)).toEqual(['desserts', 'lunch', 'pizzas', UNCATEGORISED_GROUP_ID]);
  });
});

describe('groupSelectionState', () => {
  const already = new Set(['quattro']);

  it('is "all" once every ACTIONABLE product is ticked, not every product', () => {
    // Pizzas holds three products, one of which already carries the row. Ticking the other two is
    // everything the admin can do, so the header must read as complete — counting the three would
    // leave a box that can never be filled.
    expect(groupSelectionState(groupNamed('pizzas'), new Set(['margherita', 'diavola']), already)).toBe('all');
    expect(groupNamed('pizzas').productIds).toHaveLength(3);
  });

  it('is "some" for a partial pick — the third state a checkbox needs', () => {
    expect(groupSelectionState(groupNamed('pizzas'), new Set(['margherita']), already)).toBe('some');
  });

  it('is "none" when nothing in the group is ticked', () => {
    expect(groupSelectionState(groupNamed('pizzas'), new Set(), already)).toBe('none');
  });

  it('reads a category that is entirely done as "all", not "none"', () => {
    // The control that the previous case is about TICKS and not about emptiness: with nothing left
    // to do, an empty selection is completion rather than absence.
    expect(groupSelectionState(groupNamed('desserts'), new Set(), new Set(['tiramisu']))).toBe('all');
  });
});

describe('toggleGroup', () => {
  /**
   * The selection is what the admin TICKED, not what will be sent — `buildApplyPlan` separates the
   * two. An earlier version filtered the already-attached rows out here as well, and the effect was
   * that `alreadyHaveCount` could never be anything but 0: the footer's "N already have it" was a
   * sentence the screen was structurally unable to reach. A COMPONENT test found that, not this
   * file, which is the argument for having both.
   */
  it('ticks EVERY product in the group, including one that already carries the row', () => {
    const next = toggleGroup(groupNamed('pizzas'), true, new Set());

    expect([...next].sort()).toEqual(['diavola', 'margherita', 'quattro']);
  });

  it('un-ticking one category does not clear a product the OTHER category does not hold', () => {
    // Margherita is in Pizzas and in Lunch, so clearing Lunch legitimately drops it. What must
    // survive is Diavola — a scoped un-tick that reached outside its own group would take it too.
    const both = toggleGroup(groupNamed('pizzas'), true, new Set());
    const afterLunchCleared = toggleGroup(groupNamed('lunch'), false, both);

    expect(afterLunchCleared.has('diavola')).toBe(true);
    expect(afterLunchCleared.has('quattro')).toBe(true);
    expect(afterLunchCleared.has('margherita')).toBe(false);
  });
});

describe('buildApplyPlan — the blast radius the confirm states (D6)', () => {
  it('counts DISTINCT products, so a product in two categories is one item', () => {
    // Ticking every actionable product: 4 selected ids, 4 distinct products, and Margherita is in
    // two groups. If the plan counted group membership it would say 5.
    const selected = new Set(['margherita', 'quattro', 'diavola', 'tiramisu', 'water']);
    const plan = buildApplyPlan(PRODUCTS, selected, new Set());

    expect(plan.productIds).toEqual(['margherita', 'quattro', 'diavola', 'tiramisu', 'water']);
    expect(plan.willChangeCount).toBe(5);
    expect(groups().reduce((total, group) => total + group.productIds.length, 0)).toBe(6);
  });

  it('drops an already-attached product from the request and still REPORTS it', () => {
    const selected = new Set(['margherita', 'quattro', 'diavola']);
    const plan = buildApplyPlan(PRODUCTS, selected, new Set(['quattro']));

    expect(plan.productIds).toEqual(['margherita', 'diavola']);
    expect(plan.willChangeCount).toBe(2);
    expect(plan.alreadyHaveCount).toBe(1);
    // The control: the same selection with nothing already attached changes THREE. The two numbers
    // must move independently, or "38 of 40" is a sentence the screen cannot actually produce.
    expect(buildApplyPlan(PRODUCTS, selected, new Set()).willChangeCount).toBe(3);
  });

  it('keeps the request in product-list order, so the confirm and the payload read alike', () => {
    const plan = buildApplyPlan(PRODUCTS, new Set(['water', 'margherita']), new Set());

    expect(plan.productIds).toEqual(['margherita', 'water']);
  });

  it('is empty and harmless when nothing is selected', () => {
    const plan = buildApplyPlan(PRODUCTS, new Set(), new Set());

    expect(plan).toEqual({ productIds: [], willChangeCount: 0, alreadyHaveCount: 0 });
  });
});
