import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { CartItem } from '@/components/cart/cartTypes';
import CartItemCard from './CartItemCard';

// `i18n` is part of the mock, not decoration: CartItemCard reads `i18n.language` to pick the
// variation's localized name, so a `t`-only mock throws before anything renders.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span data-testid="img">{alt}</span>,
}));

const noop = () => {};

function renderCard(item: Partial<CartItem>) {
  return render(
    <CartItemCard
      item={{ quantity: 1, unitPrice: 10, itemTotal: 10, productName: 'Combo', ...item } as unknown as CartItem}
      isSyncing={false}
      editingInstructions={null}
      setEditingInstructions={noop}
      instructionsValue=""
      setInstructionsValue={noop}
      onUpdateQuantity={noop}
      onRemoveItem={noop}
      onSaveInstructions={noop}
      styles={{}}
    />,
  );
}

// #363. /cart renders bundle components as a compact "Includes:" list and never mounts
// OrderLineSummary, so it was the ONE cart surface that could not show a component's removals —
// the /menu rail and checkout both could, which left the two carts disagreeing with each other.
describe('CartItemCard — bundle component removals', () => {
  it('shows a component’s removed ingredients', () => {
    renderCard({
      childItems: [
        {
          id: 'c1',
          quantity: 1,
          unitPrice: 0,
          itemTotal: 0,
          productName: 'Pizza',
          removedIngredientNames: ['Cheese', 'Basil'],
        },
      ],
    } as Partial<CartItem>);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText(/Removed:\s*Cheese, Basil/)).toBeInTheDocument();
  });

  // `[]` is a real server answer — the component was customized without removing anything — and
  // must not print a bare "Removed:" label. This is why the guard tests `.length`.
  it('prints no Removed label for a component with an empty list', () => {
    renderCard({
      childItems: [
        { id: 'c1', quantity: 1, unitPrice: 0, itemTotal: 0, productName: 'Pizza', removedIngredientNames: [] },
      ],
    } as Partial<CartItem>);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.queryByText(/Removed/)).not.toBeInTheDocument();
  });

  it('prints no Removed label for an uncustomized component', () => {
    renderCard({
      childItems: [{ id: 'c1', quantity: 1, unitPrice: 0, itemTotal: 0, productName: 'Pizza' }],
    } as Partial<CartItem>);

    expect(screen.queryByText(/Removed/)).not.toBeInTheDocument();
  });
});
