import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import type { ProductIngredient } from '@/types/menu';

// Stub react-i18next so t() returns the key (or its string fallback), matching how the component
// renders without an i18next provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const ingredient = (over: Partial<ProductIngredient> & { id: string }): ProductIngredient => ({
  name: over.id,
  isOptional: true,
  price: 1,
  isActive: true,
  displayOrder: 0,
  maxQuantity: 1,
  ...over,
});

const props = (over: Partial<React.ComponentProps<typeof OptionalIngredientsSection>> = {}) => ({
  ingredients: [
    ingredient({ id: 'Patty', isOptional: false, price: 5 }),
    ingredient({ id: 'Cheese', price: 2, isIncludedInBasePrice: true, maxQuantity: 3 }),
    ingredient({ id: 'Bacon', price: 3 }),
  ],
  selectedIngredients: ['Patty', 'Cheese'],
  ingredientQuantities: { Patty: 1, Cheese: 1 },
  onSelectionChange: jest.fn(),
  onQuantityChange: jest.fn(),
  currentLanguage: 'en',
  ...over,
});

describe('OptionalIngredientsSection', () => {
  it('renders nothing when every ingredient is inactive', () => {
    const { container } = render(
      <OptionalIngredientsSection {...props({ ingredients: [ingredient({ id: 'Truffle', isActive: false })] })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('locks a required ingredient — it cannot be deselected', () => {
    const onSelectionChange = jest.fn();
    const onQuantityChange = jest.fn();
    render(<OptionalIngredientsSection {...props({ onSelectionChange, onQuantityChange })} />);

    const patty = screen.getByRole('checkbox', { name: /Patty/ });
    expect(patty).toBeDisabled();

    fireEvent.click(patty);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onQuantityChange).not.toHaveBeenCalled();
  });

  // The money-path convention this component is the single writer of. The backend derives
  // IsRemoved from quantity 0 (issue #150) and lets an explicit client quantity win, so a
  // deselection MUST emit 0 — a 1 here silently re-adds the ingredient to the kitchen ticket.
  it('emits quantity 0 when an optional ingredient is deselected', () => {
    const onSelectionChange = jest.fn();
    const onQuantityChange = jest.fn();
    render(<OptionalIngredientsSection {...props({ onSelectionChange, onQuantityChange })} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Cheese/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['Patty']);
    expect(onQuantityChange).toHaveBeenCalledWith('Cheese', 0);
  });

  it('emits quantity 1 when an optional ingredient is selected', () => {
    const onSelectionChange = jest.fn();
    const onQuantityChange = jest.fn();
    render(<OptionalIngredientsSection {...props({ onSelectionChange, onQuantityChange })} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Bacon/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['Patty', 'Cheese', 'Bacon']);
    expect(onQuantityChange).toHaveBeenCalledWith('Bacon', 1);
  });

  it('shows the stepper only for a selected multi-quantity ingredient, and clamps it', () => {
    const onQuantityChange = jest.fn();
    // Bacon is selected but maxQuantity 1 → no stepper; Cheese is selected with maxQuantity 3 → stepper.
    render(
      <OptionalIngredientsSection
        {...props({
          selectedIngredients: ['Patty', 'Cheese', 'Bacon'],
          ingredientQuantities: { Cheese: 3 },
          onQuantityChange,
        })}
      />,
    );

    const increase = screen.getByRole('button', { name: '+' });
    expect(increase).toBeDisabled(); // already at maxQuantity 3

    fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(onQuantityChange).toHaveBeenCalledWith('Cheese', 2);
  });

  // F5: minus at 1 must not dead-end. It drops to 0 AND unticks, through the same deselect path as
  // the checkbox — the quantity 0 is what prints "NO xxx" on the kitchen ticket.
  it('drops to 0 and unticks when minus is pressed at quantity 1', () => {
    const onSelectionChange = jest.fn();
    const onQuantityChange = jest.fn();
    render(
      <OptionalIngredientsSection
        {...props({
          selectedIngredients: ['Patty', 'Cheese'],
          ingredientQuantities: { Cheese: 1 },
          onSelectionChange,
          onQuantityChange,
        })}
      />,
    );

    const decrease = screen.getByRole('button', { name: '-' });
    expect(decrease).not.toBeDisabled();

    fireEvent.click(decrease);

    expect(onSelectionChange).toHaveBeenCalledWith(['Patty']);
    expect(onQuantityChange).toHaveBeenCalledWith('Cheese', 0);
  });

  it('marks an unselected included-in-base optional as a deduction', () => {
    render(<OptionalIngredientsSection {...props({ selectedIngredients: ['Patty'] })} />);

    expect(screen.getByText(/-CHF 2\.00/)).toBeInTheDocument();
  });
});

// §9 — mutual exclusion (D13–D15). The rows here are the owner's own example shape: two answers to
// one question ("how done?"), which before this field could both be ticked at once.
describe('OptionalIngredientsSection — exclusion groups', () => {
  const doneness = () =>
    props({
      ingredients: [
        ingredient({ id: 'Rare', price: 0, exclusionGroup: 'doneness' }),
        ingredient({ id: 'WellDone', price: 0, exclusionGroup: 'doneness' }),
        ingredient({ id: 'Bacon', price: 3 }),
      ],
      selectedIngredients: [],
      ingredientQuantities: {},
    });

  it('explains the replacement before the guest chooses and marks the linked rows', () => {
    render(<OptionalIngredientsSection {...doneness()} />);

    expect(screen.getByRole('note')).toHaveTextContent('ingredient_choice_guest_explanation');
    expect(screen.getAllByText('ingredient_choice_badge')).toHaveLength(2);
  });

  it('does not announce a one-member or blank group that cannot replace anything', () => {
    render(
      <OptionalIngredientsSection
        {...props({
          ingredients: [
            ingredient({ id: 'Rare', exclusionGroup: 'doneness' }),
            ingredient({ id: 'Bacon', exclusionGroup: '' }),
          ],
          selectedIngredients: [],
        })}
      />,
    );

    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText('ingredient_choice_badge')).toBeNull();
  });

  it('deselects the sibling when the other member of the group is chosen', () => {
    const onSelectionChange = jest.fn();
    const onQuantityChange = jest.fn();
    render(
      <OptionalIngredientsSection
        {...doneness()}
        selectedIngredients={['Rare']}
        ingredientQuantities={{ Rare: 1 }}
        onSelectionChange={onSelectionChange}
        onQuantityChange={onQuantityChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /WellDone/ }));

    // ONE selection update carrying the whole next state — not a deselect followed by a select,
    // which would compute the second call from the stale prop and lose the first.
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(['WellDone']);
    // The dropped sibling records an explicit 0, the convention that makes the kitchen ticket able
    // to print "NO xxx" (issue #150) — a 1 there would silently re-add it.
    expect(onQuantityChange).toHaveBeenCalledWith('Rare', 0);
    expect(onQuantityChange).toHaveBeenCalledWith('WellDone', 1);
  });

  it('stays a CHECKBOX, so the guest can still end with nothing chosen', () => {
    const onSelectionChange = jest.fn();
    render(
      <OptionalIngredientsSection
        {...doneness()}
        selectedIngredients={['Rare']}
        ingredientQuantities={{ Rare: 1 }}
        onSelectionChange={onSelectionChange}
      />,
    );

    const rare = screen.getByRole('checkbox', { name: /Rare/ });
    expect(rare).toBeChecked();

    // A radio group cannot express this at all: a checked radio fires no change event when it is
    // clicked again. An exclusion group has no minimum, so this way out has to exist (D15a).
    fireEvent.click(rare);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('leaves an ungrouped ingredient alone — every row on prod today is in that state', () => {
    const onSelectionChange = jest.fn();
    const onQuantityChange = jest.fn();
    render(
      <OptionalIngredientsSection
        {...doneness()}
        selectedIngredients={['Rare']}
        ingredientQuantities={{ Rare: 1 }}
        onSelectionChange={onSelectionChange}
        onQuantityChange={onQuantityChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Bacon/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['Rare', 'Bacon']);
    // Nothing was dropped, so no quantity 0 was recorded for anything.
    expect(onQuantityChange).toHaveBeenCalledTimes(1);
    expect(onQuantityChange).toHaveBeenCalledWith('Bacon', 1);
  });

  it('does not disturb a DIFFERENT group', () => {
    const onSelectionChange = jest.fn();
    render(
      <OptionalIngredientsSection
        {...props({
          ingredients: [
            ingredient({ id: 'Rare', price: 0, exclusionGroup: 'doneness' }),
            ingredient({ id: 'White', price: 0, exclusionGroup: 'bread' }),
            ingredient({ id: 'Brown', price: 0, exclusionGroup: 'bread' }),
          ],
          selectedIngredients: ['Rare', 'White'],
          ingredientQuantities: { Rare: 1, White: 1 },
          onSelectionChange,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Brown/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['Rare', 'Brown']);
  });
});
