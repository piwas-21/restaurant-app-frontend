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

  // #363: the cart could never show a removal while the order view always could. The row existed
  // until #364 deleted it with the dead `excludedIngredientNames`; it is back on a real channel.
  it('shows removed ingredients', () => {
    render(
      <CartItemCustomizations
        item={{ removedIngredientNames: ['Onion', 'Cheese'] } as unknown as CartItem}
        styles={{}}
      />,
    );
    expect(screen.getByText('Removed:')).toBeInTheDocument();
    expect(screen.getByText('Onion, Cheese')).toBeInTheDocument();
  });

  // The row must survive as the ONLY customization — the early return has to count it, or a line
  // whose sole change was a removal renders nothing at all.
  it('renders the block when a removal is the only customization', () => {
    const { container } = render(
      <CartItemCustomizations item={{ removedIngredientNames: ['Onion'] } as unknown as CartItem} styles={{}} />,
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText('Onion')).toBeInTheDocument();
  });

  // `[]` is a REAL server answer — a line that was customized without removing anything — and it
  // must not print a bare "Removed:" label. This is why the guard tests `.length`, not truthiness.
  it('renders no Removed row for an empty list', () => {
    const { container } = render(
      <CartItemCustomizations
        item={{ removedIngredientNames: [], selectedIngredientNames: ['Cheese'] } as unknown as CartItem}
        styles={{}}
      />,
    );
    expect(screen.getByText('Cheese')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Removed');
  });
});
