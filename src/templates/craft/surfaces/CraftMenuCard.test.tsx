import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CraftMenuCard from './CraftMenuCard';
import type { CatalogItem } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, arg?: unknown) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object') return `${key}(${Object.values(arg).join(',')})`;
      return key;
    },
  }),
}));

const product: CatalogItem = {
  kind: 'product',
  id: 'p1',
  name: 'Margherita',
  content: { en: { name: 'Margherita', description: 'Classic pizza' } },
  imageUrl: 'pizza.jpg',
  price: 12.5,
  isBundle: false,
  allergens: ['vegan'],
  dietaryTags: [],
};

describe('CraftMenuCard', () => {
  it('renders allergen tags WITH their icon (shared AllergenDisplay, not the old raw-key text)', () => {
    render(<CraftMenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);
    // The vegan tag now shows the emoji icon + a translated label (was: "allergens: vegan", no icon).
    expect(screen.getByText('🌱')).toBeInTheDocument();
    expect(screen.getByText('vegan')).toBeInTheDocument();
  });

  it('keeps BOTH craft actions: Add fast-adds (no forceSheet); Details + title force the sheet', () => {
    const onOpen = jest.fn();
    const { container } = render(<CraftMenuCard item={product} onOpen={onOpen} onFeedbackSuccess={jest.fn()} />);

    // Add to Order: no forceSheet, so a simple product can add straight to the cart.
    fireEvent.click(screen.getByRole('button', { name: 'add_item_to_order(Margherita)' }));
    expect(onOpen).toHaveBeenLastCalledWith(product);

    // Details: forceSheet so the sheet ALWAYS opens to view the item.
    fireEvent.click(screen.getByRole('button', { name: 'details' }));
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });

    // The dotted-leader title is a view affordance too — forces the sheet, never adds.
    fireEvent.click(container.querySelector('#item-name-p1') as HTMLElement);
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });
  });
});
