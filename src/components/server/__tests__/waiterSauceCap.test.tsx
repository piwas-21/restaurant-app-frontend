import '@testing-library/jest-dom';
import { act, renderHook, render, screen } from '@testing-library/react';
import useWaiterIngredientSelection from '../useWaiterIngredientSelection';
import WaiterExtrasSection from '../WaiterExtrasSection';
import type { DetailedIngredient } from '../productCustomizationTypes';

/**
 * Waiter-sheet parity for the sauce cap (MENU-OPTION-GROUP-CORRECTION-PLAN P4).
 *
 * The server refuses a fourth distinct sauce on the waiter path with `SauceMaximumExceeded`
 * (`OrderLineIngredientChoice` → `SauceSelectionRule`), so money and data were already safe. What
 * was not: the waiter learned the rule from a FAILED ORDER at the table, while the guest sheet
 * greyed the fourth sauce out. The hook is driven through its own API — seed, then toggle — the
 * same way `waiterExclusionGroup.test.tsx` drives it.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const row = (over: Partial<DetailedIngredient> & { id: string }): DetailedIngredient => ({
  name: over.id,
  isActive: true,
  isOptional: true,
  price: 0,
  maxQuantity: 1,
  displayOrder: 0,
  ...over,
});
const sauce = (id: string) => row({ id, kind: 'sauce' });

const recipe: DetailedIngredient[] = [
  sauce('mayo'),
  sauce('ketchup'),
  sauce('white'),
  sauce('harissa'),
  row({ id: 'bacon', price: 2 }),
  row({ id: 'cheese', price: 1 }),
  row({ id: 'egg', price: 1 }),
  // No price at all — the chip's `price ?? 0` fallback, so the row renders with no suffix.
  row({ id: 'onion', price: undefined }),
];

function seeded(cap?: number | null) {
  const hook = renderHook(() => useWaiterIngredientSelection());
  act(() => hook.result.current.seedFromBaseRecipe(recipe, cap));
  return hook;
}
const ids = (result: { current: { selectedIngredients: ReadonlySet<string> } }) =>
  [...result.current.selectedIngredients].sort();

describe('useWaiterIngredientSelection — the sauce cap', () => {
  it('accepts the third distinct sauce and refuses the fourth', () => {
    const { result } = seeded(3);

    for (const id of ['mayo', 'ketchup', 'white']) act(() => result.current.toggleIngredient(sauce(id)));
    expect(ids(result)).toEqual(['ketchup', 'mayo', 'white']);
    expect(result.current.isSauceGroupFull).toBe(true);

    act(() => result.current.toggleIngredient(sauce('harissa')));

    expect(ids(result)).toEqual(['ketchup', 'mayo', 'white']);
    // Refused means untouched: no id, and no quantity entry that a payload could carry as a row.
    expect(result.current.ingredientQuantities).not.toHaveProperty('harissa');
  });

  it('lets a full group swap one sauce for another', () => {
    const { result } = seeded(3);
    for (const id of ['mayo', 'ketchup', 'white']) act(() => result.current.toggleIngredient(sauce(id)));

    act(() => result.current.toggleIngredient(sauce('white')));
    expect(result.current.isSauceGroupFull).toBe(false);
    act(() => result.current.toggleIngredient(sauce('harissa')));

    expect(ids(result)).toEqual(['harissa', 'ketchup', 'mayo']);
    expect(result.current.ingredientQuantities.white).toBe(0);
  });

  it('never lets four non-sauce extras spend the sauce allowance (negative control)', () => {
    const { result } = seeded(3);

    for (const id of ['bacon', 'cheese', 'egg', 'onion']) act(() => result.current.toggleIngredient(row({ id })));

    expect(ids(result)).toEqual(['bacon', 'cheese', 'egg', 'onion']);
    expect(result.current.isSauceGroupFull).toBe(false);
  });

  it('an absent cap means no refusal', () => {
    const { result } = seeded(null);

    for (const id of ['mayo', 'ketchup', 'white', 'harissa']) act(() => result.current.toggleIngredient(sauce(id)));

    expect(ids(result)).toEqual(['harissa', 'ketchup', 'mayo', 'white']);
    expect(result.current.isSauceGroupFull).toBe(false);
  });

  it('a cap of zero is a real cap, not "unbounded"', () => {
    const { result } = seeded(0);

    expect(result.current.isSauceGroupFull).toBe(true);
    act(() => result.current.toggleIngredient(sauce('mayo')));

    expect(ids(result)).toEqual([]);
  });

  it('a required sauce is part of the recipe: it never spends the cap and is never swapped off', () => {
    const withBase = [row({ id: 'house', kind: 'sauce', isOptional: false }), ...recipe];
    const hook = renderHook(() => useWaiterIngredientSelection());
    act(() => hook.result.current.seedFromBaseRecipe(withBase, 1));
    const { result } = hook;

    expect(result.current.isSauceGroupFull).toBe(false);
    act(() => result.current.toggleIngredient(sauce('mayo')));
    act(() => result.current.toggleIngredient(sauce('ketchup')));

    expect(ids(result)).toEqual(['house', 'ketchup']);
    expect(result.current.ingredientQuantities.house).toBe(1);
  });

  it('a cap of one SWAPS, as the guest radio does, and records the leaving sauce as removed', () => {
    const { result } = seeded(1);

    act(() => result.current.toggleIngredient(sauce('mayo')));
    act(() => result.current.toggleIngredient(sauce('ketchup')));

    expect(ids(result)).toEqual(['ketchup']);
    expect(result.current.ingredientQuantities.mayo).toBe(0);
    expect(result.current.ingredientQuantities.ketchup).toBe(1);
  });

  it('guards the stepper too: a plus on an unselected sauce past the cap is refused', () => {
    const cap = seeded(3);
    for (const id of ['mayo', 'ketchup', 'white']) act(() => cap.result.current.toggleIngredient(sauce(id)));

    act(() => cap.result.current.stepIngredient(sauce('harissa'), 1));

    expect(ids(cap.result)).toEqual(['ketchup', 'mayo', 'white']);
    expect(cap.result.current.ingredientQuantities).not.toHaveProperty('harissa');

    // …and swaps under a cap of one, the same as a tap would.
    const one = seeded(1);
    act(() => one.result.current.toggleIngredient(sauce('mayo')));
    act(() => one.result.current.stepIngredient(sauce('ketchup'), 1));

    expect(ids(one.result)).toEqual(['ketchup']);
    expect(one.result.current.ingredientQuantities.mayo).toBe(0);
  });
});

describe('WaiterExtrasSection — what a full sauce group looks like', () => {
  const noop = () => {};

  it('announces the unchosen sauces disabled, leaves chosen sauces and extras alone, and says why', () => {
    render(
      <WaiterExtrasSection
        ingredients={recipe}
        selectedIngredients={new Set(['mayo', 'ketchup', 'white'])}
        ingredientQuantities={{ mayo: 1, ketchup: 1, white: 1 }}
        onToggle={noop}
        onStep={noop}
        nameOf={(ingredient) => ingredient.name}
        sauceMax={3}
        isSauceGroupFull
      />,
    );

    expect(screen.getByRole('button', { name: 'harissa' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /mayo/ })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: /bacon/ })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByText('sauce_max_reached')).toBeInTheDocument();
  });

  it('keeps every sauce chip live under a cap of one, because a tap swaps', () => {
    render(
      <WaiterExtrasSection
        ingredients={recipe}
        selectedIngredients={new Set(['mayo'])}
        ingredientQuantities={{ mayo: 1 }}
        onToggle={noop}
        onStep={noop}
        nameOf={(ingredient) => ingredient.name}
        sauceMax={1}
        isSauceGroupFull
      />,
    );

    expect(screen.queryByText('sauce_max_reached')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'harissa' })).not.toHaveAttribute('aria-disabled');
  });

  it('says nothing about a cap when the product lists no sauce rows', () => {
    render(
      <WaiterExtrasSection
        ingredients={recipe.filter((ingredient) => ingredient.kind !== 'sauce')}
        selectedIngredients={new Set()}
        ingredientQuantities={{}}
        onToggle={noop}
        onStep={noop}
        nameOf={(ingredient) => ingredient.name}
        sauceMax={2}
        isSauceGroupFull
      />,
    );

    // `sauceMax` 2 and "full", so only the sauce-row guard keeps the badge off — a `0` cap would
    // pass on the `> 1` clause alone and prove nothing.
    expect(screen.queryByText('sauce_max_reached')).not.toBeInTheDocument();
  });

  it('shows neither the badge nor a disabled chip while the group has room', () => {
    render(
      <WaiterExtrasSection
        ingredients={recipe}
        selectedIngredients={new Set(['mayo'])}
        ingredientQuantities={{ mayo: 1 }}
        onToggle={noop}
        onStep={noop}
        nameOf={(ingredient) => ingredient.name}
        sauceMax={3}
        isSauceGroupFull={false}
      />,
    );

    expect(screen.queryByText('sauce_max_reached')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'harissa' })).not.toHaveAttribute('aria-disabled');
  });
});
