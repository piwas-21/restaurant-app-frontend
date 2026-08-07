import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MenuCard from './MenuCard';
import type { CatalogItem } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useOptionalAuth } from '@/components/AuthContext';
import { updateProductPrice } from '@/services/productService';
import { useItemAvailabilityNotice, type AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';

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

// The availability notice is decided by a hook that reads OrderTypeContext + TableContext + the
// admin-enabled channel list. Those are the SUBJECT of `useItemAvailabilityNotice.test.ts`; here we
// only care what the card does with the answer, so the hook is stubbed and defaults to "nothing to
// say" — keeping these tests provider-less like the rest of the file.
jest.mock('@/hooks/menu/useTrackItemBlocked', () => ({ useTrackItemBlocked: jest.fn() }));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
  // The predicate is deliberately NOT stubbed. It is the thing under test here — the three item
  // surfaces diverged precisely because each derived "blocked" for itself, and a mock would let
  // that happen again invisibly.
  isItemBlocked: jest.requireActual('@/hooks/menu/useItemAvailabilityNotice').isItemBlocked,
}));

const product: CatalogItem = {
  kind: 'product',
  id: 'p1',
  name: 'Margherita',
  content: { en: { name: 'Margherita', description: 'Classic pizza' } },
  imageUrl: 'pizza.jpg',
  price: 12.5,
  isBundle: false,
  priceEditability: 'editable',
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

beforeEach(() => jest.clearAllMocks());

describe('MenuCard — one card for both catalog kinds', () => {
  it('renders a product with its title, allergens and price', () => {
    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByText('Margherita')).toBeInTheDocument();
    // ONE price node. The card used to render two — `.itemPrice` in MenuItemDetails above 600px
    // and a separate `.mobilePrice` below it — with only CSS deciding which was showing. The price
    // lives on the action row at every viewport now, and carries the accessible label the
    // desktop-only node used to own.
    expect(screen.getByText('CHF 12.50')).toHaveAttribute('aria-label', 'checkout_total_label CHF 12.50');
    // The description IS rendered now (it is the card's details affordance). Ingredients are not:
    // that block in MenuItemDetails is still commented out, and this card does not second-guess it.
    expect(screen.getByText('Classic pizza')).toBeInTheDocument();
    expect(screen.queryByText('Tomato, Basil')).not.toBeInTheDocument();
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
    // Its accessible name carries the DISH, not just "Details" — every card offers one, and a
    // screen-reader user listing the page's buttons would otherwise get N identical entries.
    fireEvent.click(screen.getByRole('button', { name: 'menu_item_details_aria(Margherita)' }));
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });

    // The clickable title is a view affordance too — it forces the sheet, never adds.
    // Exact name so it doesn't also match the Add button's "add_item_to_order(Margherita)".
    fireEvent.click(screen.getByRole('button', { name: 'Margherita' }));
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });
  });

  it("forces the sheet for a bundle's Details too — no separate bundle details modal", () => {
    const onOpen = jest.fn();
    render(<MenuCard item={bundle} onOpen={onOpen} onFeedbackSuccess={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'menu_item_details_aria(Lunch Combo)' }));
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

  it('swaps the price editor for a reason when the price is derived (e.g. has variations)', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    render(
      <MenuCard
        item={{ ...product, priceEditability: 'variations' }}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-edit-price-locked')).toBeInTheDocument();
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

  it('keeps the editor open and the price unchanged when the save fails', async () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });
    (updateProductPrice as jest.Mock).mockRejectedValue(new Error('forbidden'));

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(updateProductPrice).toHaveBeenCalled());
    expect(screen.getByTestId('admin-price-input')).toBeInTheDocument(); // still editing
    expect(screen.getAllByText('CHF 12.50').length).toBeGreaterThan(0); // original price kept
  });

  it('refuses to save a cleared price — no accidental free item', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    expect(updateProductPrice).not.toHaveBeenCalled();
    expect(screen.getByTestId('admin-price-input')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('MenuCard — per-order-type availability (S4)', () => {
  const mockedNotice = useItemAvailabilityNotice as jest.Mock;
  afterEach(() => mockedNotice.mockReturnValue(null));

  const INFO: AvailabilityNotice = {
    tone: 'info',
    message: 'Takeaway and Delivery only',
    switchTo: null,
    switchLabel: '',
    hint: null,
  };
  const BLOCKED: AvailabilityNotice = {
    tone: 'blocked',
    message: 'Takeaway and Delivery only',
    switchTo: OrderType.Takeaway,
    switchLabel: 'Switch to Takeaway',
    hint: null,
  };

  /**
   * The reported half of E6. `useItemAvailabilityNotice` returns null on purpose for
   * `reason: 'Unavailable'` (there is nothing useful to say — there is no stock concept), and the
   * card used to derive "blocked" from the notice alone. So a server verdict of `canOrder: false`
   * left the card undimmed with a live "Add to order" — while the featured-special hero, which
   * carried the extra clause, dimmed the very same item.
   */
  it('dims and drops Add on a server refusal even when there is no notice to show', () => {
    mockedNotice.mockReturnValue(null);

    const { container } = render(
      <MenuCard
        item={{ ...product, availability: { canOrder: false } as never }}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
      />,
    );

    expect(container.querySelector('li')).toHaveClass('blocked');
    expect(screen.queryByRole('button', { name: 'add_item_to_order(Margherita)' })).not.toBeInTheDocument();
  });

  it('renders nothing extra when the server reports no restriction', () => {
    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.queryByText('Takeaway and Delivery only')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add_item_to_order(Margherita)' })).toBeInTheDocument();
  });

  it('info tone: chips the reason but keeps the card fully orderable — the dominant browse state', () => {
    mockedNotice.mockReturnValue(INFO);

    const { container } = render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByText('Takeaway and Delivery only')).toBeInTheDocument();
    // No dimming, no CTA, and Add still works — a guest who has chosen nothing is not blocked.
    expect(container.querySelector('li')).not.toHaveClass('blocked');
    expect(screen.queryByRole('button', { name: 'Switch to Takeaway' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add_item_to_order(Margherita)' })).toBeInTheDocument();
  });

  it('blocked tone: dims, folds the reason into the accessible name, and REPLACES Add with the switch', () => {
    const onSwitchOrderType = jest.fn();
    mockedNotice.mockReturnValue(BLOCKED);

    const { container } = render(
      <MenuCard
        item={product}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
        onSwitchOrderType={onSwitchOrderType}
      />,
    );

    const card = container.querySelector('li') as HTMLElement;
    expect(card).toHaveClass('blocked');
    // Both ids — the name AND the reason — so the card announces WHY it is dimmed.
    expect(card).toHaveAttribute('aria-labelledby', 'item-name-p1 item-availability-p1');
    expect(container.querySelector('#item-availability-p1')).toHaveTextContent('Takeaway and Delivery only');

    // Add is gone rather than disabled: a disabled control fires no click and explains nothing.
    expect(screen.queryByRole('button', { name: 'add_item_to_order(Margherita)' })).not.toBeInTheDocument();
    // …but Details stays live, so the guest can still read the item.
    expect(screen.getByRole('button', { name: 'menu_item_details_aria(Margherita)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Takeaway' }));
    expect(onSwitchOrderType).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  it('offers no switch when the host wired no handler — never a dead control', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Switch to Takeaway' })).not.toBeInTheDocument();
    expect(screen.getByText('Takeaway and Delivery only')).toBeInTheDocument();
  });

  it('QR-pinned dine-in: shows the ask-your-server hint instead of a nonsensical switch', () => {
    mockedNotice.mockReturnValue({ ...BLOCKED, switchTo: null, switchLabel: '', hint: 'Ask your server' });

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} onSwitchOrderType={jest.fn()} />);

    expect(screen.getByText('Ask your server')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
  });

  it('hands the blocked verdict to analytics — the impression IS the only observable moment (§4.4)', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(useTrackItemBlocked).toHaveBeenCalledWith('p1', BLOCKED);
  });
});
