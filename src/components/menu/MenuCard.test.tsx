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
    expect(screen.getByLabelText('checkout_total_label CHF 12.50')).toHaveTextContent('CHF 12.50');
    // The description IS rendered now (it is the card's details affordance). Ingredients are not:
    // that block in MenuItemDetails is still commented out, and this card does not second-guess it.
    expect(screen.getByText('Classic pizza')).toBeInTheDocument();
    expect(screen.queryByText('Tomato, Basil')).not.toBeInTheDocument();
  });

  it('prints a starting price as "from", so a hidden base row is never quoted at a price nobody can pay', () => {
    // Track F / F2. The mocked `t` echoes `key(values)`, so the assertion is that the card asked
    // for the `price_from` sentence with the formatted amount — not that it printed the bare number.
    render(
      <MenuCard
        item={{ ...product, price: 6.5, priceIsFrom: true }}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
      />,
    );

    expect(screen.getByText('price_from(CHF 6.50)')).toBeInTheDocument();
    expect(screen.queryByText('CHF 6.50')).not.toBeInTheDocument();
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

  /**
   * The ribbon belongs to the PHOTO. Positioned against the `<li>` it only landed correctly where
   * the photo is full-bleed across the top of a grid card; on the ≤600px row the photo is an 88px
   * square inset by the card's padding, so the badge floated over the padding beside it (visible
   * in the committed mobile baseline). Asserted structurally rather than by class, because the
   * containing block is what the CSS depends on.
   */
  it('pins the Special ribbon inside the photo, not over the card', () => {
    const { container } = render(<MenuCard item={bundle} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    const badge = container.querySelector('[data-testid="special-badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge?.closest('[data-testid="menu-item-image"]')).not.toBeNull();
  });

  /**
   * Moving the badge inside the enlarge `<button>` puts it behind that button's `aria-label`, so
   * the word would have left the accessible tree entirely. It comes back on the card's own name,
   * the same way the blocked reason already does — "Special Lunch Combo", not a decorative corner
   * only sighted guests can see.
   */
  it('keeps "Special" in the card accessible name once the badge moves into the photo', () => {
    const { container } = render(<MenuCard item={bundle} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(container.querySelector('li')).toHaveAttribute('aria-labelledby', 'item-special-b1 item-name-b1');
    expect(container.querySelector('#item-special-b1')).toHaveTextContent('special');
  });

  /**
   * Details is the DESCRIPTION's affordance — it opens the sheet holding the rest of the sentence
   * the paragraph clamps. It used to render last, after the allergen block and the dietary chips,
   * which on a RUMI card (neither populated) stranded it above the price rule with nothing to
   * attach to. Pinned as an immediate sibling so it cannot drift back out of place.
   */
  it('renders Details INSIDE the description, the allergens on the PHOTO and the price in the foot', () => {
    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    const description = screen.getByText('Classic pizza', { selector: 'p' });
    const details = screen.getByRole('button', { name: 'menu_item_details_aria(Margherita)' });
    // Queried by testid, not by `role="group"`: that role is gone (typescript:S6819 — the rule
    // wants a native element, and none of the four it offers fits a row of non-interactive chips).
    // The grouping is carried as visually-hidden TEXT instead, asserted just below.
    const allergens = screen.getByTestId('allergen-chips');
    // Queried by id, not by role: the title carries `role="button"` (it opens the same sheet), so
    // it is deliberately NOT a heading in the accessibility tree.
    const title = document.getElementById('item-name-p1')!;

    // Details is a CHILD of the paragraph, not its next sibling: it is floated to the end of the
    // description's second line ("…grilled sourdough... Details"), which is where
    // `mobile_menu_light` draws it. As a sibling it cost every card a whole line of height and, on
    // the many dishes with no allergens, left the word floating in a blank band.
    expect(description.tagName).toBe('P');
    expect(description.contains(details)).toBe(true);
    // It has to be FIRST in the paragraph — a float is only wrapped by content that follows it, so
    // moving it after the text puts the link back under the paragraph instead of on its last line.
    expect(description.firstElementChild).toBe(details);

    // The allergens are ON THE PHOTOGRAPH — not on the dish name's line, where the owner's
    // 2026-08-09 review found them too noisy beside the price. Asserted by containment rather than
    // by class, because the class is what a rendering test cannot see (`identity-obj-proxy` makes
    // every CSS-module lookup truthy — trap 11).
    //
    // In the photo's FRAME and deliberately NOT inside the enlarge button, which is
    // children-presentational and would prune the chips out of the accessibility tree. That is its
    // own defect with its own case — `MenuCardImage.test.tsx` — and this line only pins that the
    // chips ended up on the picture rather than back in the text column.
    const enlarge = screen.getByTestId('menu-item-image');
    const photoFrame = enlarge.parentElement!;
    expect(photoFrame.contains(allergens)).toBe(true);
    // The word a screen reader hears before the chips. It replaced an `aria-label` on a
    // `role="group"`, so losing it would quietly strip the context rather than break a query.
    expect(allergens).toHaveTextContent('Allergens');
    expect(enlarge.contains(allergens)).toBe(false);
    expect(title.contains(allergens)).toBe(false);
    // …and BEFORE the name in the document, since the photo sits above the text column.
    expect(allergens.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The price left the title row for the card's foot, where it shares a baseline with the add
    // control. Both are after the description; the price comes first in the row.
    const price = screen.getByLabelText(/checkout_total_label/);
    const add = screen.getByRole('button', { name: 'add_item_to_order(Margherita)' });
    expect(title.contains(price)).toBe(false);
    expect(description.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(price.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  /**
   * S14: the CARD marks itself while its price is open, not just the price row.
   *
   * The screenshot suite runs as a guest, so it never renders any of this — the whole admin surface
   * is invisible to it. And the row-level signal it replaces was genuinely weak: the editor lives
   * inside one ~200px price row, so on a grid of cards the only indication of WHICH card was open
   * was that row changing shape. All five classic admin screens that draw an editing state mark the
   * whole card instead; three ring it and two use a brand border plus a wash. `outline` is the
   * decision (see AdminPriceEditorHost.module.css), the whole-card mark is the transcription.
   *
   * Asserted on the `<li>` rather than by querying for the class, so it fails if the class is
   * applied to the wrong element — which is the mistake worth catching, the ring being invisible
   * from the component's own markup. `identity-obj-proxy` maps the CSS Module name through.
   */
  it('rings the whole card while its price is being edited, and stops when the edit ends', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    const { container } = render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);
    const card = container.querySelector('li');

    expect(card).not.toHaveClass('hostEditing');

    fireEvent.click(screen.getByTestId('admin-edit-price'));
    expect(card).toHaveClass('hostEditing');

    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(card).not.toHaveClass('hostEditing');
  });

  /** A guest's card must never carry the mark — and `'hidden'` is reported, not merely absent. */
  it('never rings a guest card', () => {
    const { container } = render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(container.querySelector('li')).not.toHaveClass('hostEditing');
    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
  });

  it('keeps Add visible beside a bundle’s locked price reason', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    render(<MenuCard item={bundle} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-price-locked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add_item_to_order(Lunch Combo)' })).toBeEnabled();
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
    shortMessage: '',
    hint: null,
  };
  const BLOCKED: AvailabilityNotice = {
    tone: 'blocked',
    message: 'Takeaway and Delivery only',
    switchTo: OrderType.Takeaway,
    switchLabel: 'Switch to Takeaway',
    shortMessage: 'Not for Dine-in',
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
    // TWO nodes carry the reason on a blocked card, by design: the corner ribbon (a glance-level
    // marker readable across a grid) and the sentence above the switch. `getAllByText` rather than
    // `getByText` because a single-match query here would go red the day the ribbon was added and
    // read as "the reason disappeared".
    expect(screen.getAllByText('Takeaway and Delivery only')).toHaveLength(2);
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
  it('is addressable as a card, separately from the hero sharing its grid', () => {
    // The Chef's Special is a cell OF the menu grid now, and when the promoted dish is also in the
    // catalogue its hero and its card offer a button with the SAME accessible name ("Add <dish> to
    // order"). Role+name cannot separate them and neither can `data-testid="menu-grid"`, which
    // contains both — so the screenshot suite addresses the card directly. It shipped without this
    // once and the failure was a strict-mode violation in CI, not a red test.
    render(<MenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByTestId('menu-card')).toBeInTheDocument();
  });
});
