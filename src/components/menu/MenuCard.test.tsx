import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuCard from './MenuCard';
import type { CatalogItem } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, arg?: unknown) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object') {
        return `${key}(${Object.values(arg).join(',')})`;
      }
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
  allergens: ['gluten'],
  dietaryTags: [],
  detailedIngredients: [
    { id: 'i1', name: 'Tomato', isOptional: false, price: 0, isActive: true, displayOrder: 1 },
    { id: 'i2', name: 'Basil', isOptional: false, price: 0, isActive: true, displayOrder: 2 },
    { id: 'i3', name: 'Truffle', isOptional: true, price: 5, isActive: false, displayOrder: 3 },
  ],
};

const bundle: CatalogItem = {
  kind: 'bundle',
  id: 'b1',
  name: 'Lunch Combo',
  content: { en: { name: 'Lunch Combo', description: 'Main + drink' } },
  imageUrl: 'combo.jpg',
  price: 15,
  isBundle: true,
  isSpecial: true,
  bundleItemNames: ['Pizza', 'Cola'],
};

describe('MenuCard — one card for both catalog kinds', () => {
  it('renders a product with its title, allergens and price', () => {
    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByText('Margherita')).toBeInTheDocument();
    // Two nodes by design: the card carries a separate mobile price that CSS swaps in.
    expect(screen.getAllByText('CHF 12.50')).toHaveLength(2);
    // A product shows no summary block: MenuItemDetails keeps its ingredient/description blocks
    // commented out, and this card does not second-guess that.
    expect(screen.queryByText('Tomato, Basil')).not.toBeInTheDocument();
    expect(screen.queryByText('Classic pizza')).not.toBeInTheDocument();
  });

  it('keeps a combo description and its default picks — the bundle card rendered both itself', () => {
    render(<MenuCard item={bundle} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByText('Lunch Combo')).toBeInTheDocument();
    expect(screen.getByText('Main + drink')).toBeInTheDocument();
    expect(screen.getByText('Pizza + Cola')).toBeInTheDocument();
    expect(screen.getByText('special')).toBeInTheDocument();
  });

  it('omits the combo summary block when there is nothing to summarise', () => {
    render(
      <MenuCard
        item={{ ...bundle, content: { en: { name: 'Lunch Combo' } }, bundleItemNames: undefined }}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
      />,
    );

    expect(screen.getByText('Lunch Combo')).toBeInTheDocument();
    expect(screen.queryByText('Pizza + Cola')).not.toBeInTheDocument();
  });

  it('badges only the items flagged special', () => {
    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.queryByText('special')).not.toBeInTheDocument();
  });

  it('opens the sheet from Add and from Details — one surface, not two', () => {
    const onOpen = jest.fn();
    render(<MenuCard item={product} onOpen={onOpen} onFeedbackSuccess={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'add_item_to_order(Margherita)' }));
    expect(onOpen).toHaveBeenCalledWith(product);

    fireEvent.click(screen.getByRole('button', { name: 'details' }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('opens the sheet for a bundle too — no separate bundle details modal', () => {
    const onOpen = jest.fn();
    render(<MenuCard item={bundle} onOpen={onOpen} onFeedbackSuccess={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'details' }));
    expect(onOpen).toHaveBeenCalledWith(bundle);
  });
});
