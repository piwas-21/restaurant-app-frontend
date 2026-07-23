import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MenuCard from './MenuCard';
import type { CatalogItem } from '@/types/menu';
import { useOptionalAuth } from '@/components/AuthContext';
import { updateProductPrice } from '@/services/productService';

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

// The admin edit affordance reads auth via useOptionalAuth. Default to a guest so the
// existing (provider-less) tests keep rendering no control; individual tests opt into admin.
jest.mock('@/components/AuthContext', () => ({
  useOptionalAuth: jest.fn(() => null),
}));

jest.mock('@/services/productService', () => ({
  updateProductPrice: jest.fn(),
}));

const product: CatalogItem = {
  kind: 'product',
  id: 'p1',
  name: 'Margherita',
  content: { en: { name: 'Margherita', description: 'Classic pizza' } },
  imageUrl: 'pizza.jpg',
  price: 12.5,
  isBundle: false,
  priceEditable: true,
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
    const { container } = render(<MenuCard item={bundle} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByText('Lunch Combo')).toBeInTheDocument();
    expect(screen.getByText('Main + drink')).toBeInTheDocument();
    expect(screen.getByText('Pizza + Cola')).toBeInTheDocument();
    // Assert the badge element, not its text: the i18n stub echoes the key, so asserting on
    // "special" would pass whether or not the key exists in the locales.
    expect(container.querySelector('[data-testid="special-badge"]')).toBeInTheDocument();
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
    const { container } = render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(container.querySelector('[data-testid="special-badge"]')).not.toBeInTheDocument();
  });

  it('Add opens without forcing (fast-add allowed) but Details forces the sheet — never a silent add', () => {
    const onOpen = jest.fn();
    render(<MenuCard item={product} onOpen={onOpen} onFeedbackSuccess={jest.fn()} />);

    // Add to Order: no forceSheet, so a simple product can add straight to the cart.
    fireEvent.click(screen.getByRole('button', { name: 'add_item_to_order(Margherita)' }));
    expect(onOpen).toHaveBeenLastCalledWith(product);

    // Details: forceSheet so the sheet ALWAYS opens to view the item (the #234 regression).
    fireEvent.click(screen.getByRole('button', { name: 'details' }));
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });

    // The clickable title is a view affordance too — it forces the sheet, never adds.
    // Exact name so it doesn't also match the Add button's "add_item_to_order(Margherita)".
    fireEvent.click(screen.getByRole('button', { name: 'Margherita' }));
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });
  });

  it("forces the sheet for a bundle's Details too — no separate bundle details modal", () => {
    const onOpen = jest.fn();
    render(<MenuCard item={bundle} onOpen={onOpen} onFeedbackSuccess={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'details' }));
    expect(onOpen).toHaveBeenCalledWith(bundle, { forceSheet: true });
  });
});

describe('MenuCard — admin quick-edit', () => {
  afterEach(() => (useOptionalAuth as jest.Mock).mockReturnValue(null));

  it('deep-links an admin to the item editor', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-item')).toHaveAttribute('href', '/admin/menu-management/p1');
  });

  it('shows no edit affordance for a guest', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue(null);

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-item')).not.toBeInTheDocument();
  });

  it('offers an inline price editor for an admin on a priceEditable product', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-price')).toBeInTheDocument();
  });

  it('hides the price editor when the product is not priceEditable (e.g. has variations)', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    render(<MenuCard item={{ ...product, priceEditable: false }} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
  });

  it('persists an inline price edit and reflects the new price on the card', async () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });
    (updateProductPrice as jest.Mock).mockResolvedValue({ success: true, data: 14.5 });

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '14.50' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(updateProductPrice).toHaveBeenCalledWith('p1', 14.5));
    await waitFor(() => expect(screen.getAllByText('CHF 14.50').length).toBeGreaterThan(0));
  });
});
