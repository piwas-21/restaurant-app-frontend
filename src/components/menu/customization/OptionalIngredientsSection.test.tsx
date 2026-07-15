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

  it('marks an unselected included-in-base optional as a deduction', () => {
    render(<OptionalIngredientsSection {...props({ selectedIngredients: ['Patty'] })} />);

    expect(screen.getByText(/-CHF 2\.00/)).toBeInTheDocument();
  });
});
