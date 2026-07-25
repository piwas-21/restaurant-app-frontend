import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { CartItem } from '@/components/cart/cartTypes';
import CartItemCustomizations from './CartItemCustomizations';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('CartItemCustomizations', () => {
  it('renders nothing when the item has only special instructions (owned by the editor now)', () => {
    const { container } = render(
      <CartItemCustomizations item={{ specialInstructions: 'No onions' } as unknown as CartItem} styles={{}} />,
    );
    // No duplicate "special requests" line here — the instructions editor owns display + edit.
    expect(container).toBeEmptyDOMElement();
  });

  it('shows ingredient customizations but NOT a special-requests row', () => {
    render(
      <CartItemCustomizations
        item={{ selectedIngredientNames: ['Cheese'], specialInstructions: 'No onions' } as unknown as CartItem}
        styles={{}}
      />,
    );
    expect(screen.getByText('Cheese')).toBeInTheDocument();
    expect(screen.queryByText(/No onions/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Special Requests/)).not.toBeInTheDocument();
  });
});
