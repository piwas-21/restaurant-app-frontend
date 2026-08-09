import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CraftMenuCard from './CraftMenuCard';
import type { CatalogItem } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useOptionalAuth } from '@/components/AuthContext';
import { useItemAvailabilityNotice, type AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';

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

// Default to a guest so the existing (provider-less) tests render no admin control.
jest.mock('@/components/AuthContext', () => ({
  useOptionalAuth: jest.fn(() => null),
}));

// Same stub as the shared card's test: the notice DECISION is covered by
// `useItemAvailabilityNotice.test.ts`; here we pin what craft renders from it.
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
  allergens: ['vegan'],
  dietaryTags: [],
};

describe('CraftMenuCard', () => {
  /**
   * Craft renders the SHARED `AllergenDisplay` (was: a raw "allergens: vegan" string of its own),
   * and it takes the shared chip treatment with it — deliberately, not by accident. The rule that
   * replaced eleven colour families is written entirely in semantic tokens, so craft repaints it
   * olive-on-kraft from its own `tokens.css` rather than inheriting classic's greys.
   *
   * This used to assert the vegan emoji. D9 removed it: `vegan` is a dietary *claim* and claims get
   * no glyph, so the assertion is now the split itself — the substance chip carries one, the claim
   * does not, on craft exactly as on classic.
   */
  it('renders the shared allergen chips, one distinct glyph per allergen', () => {
    const { container } = render(
      <CraftMenuCard
        item={{ ...product, allergens: ['vegan', 'sesame'] }}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
      />,
    );

    // Craft reads the SAME `AllergenIcon` table classic does — the point of the shared component is
    // that a tenant on either skin sees the same mark for the same substance. D9's one-triangle rule
    // is superseded: every allergen carries its own glyph now, claims included.
    const chipFor = (word: string) => screen.getByText(word).closest('.allergenTag') as HTMLElement;
    expect(chipFor('vegan')).toBeInTheDocument();
    expect(chipFor('vegan').querySelector('svg')).toBeInTheDocument();
    expect(chipFor('sesame').querySelector('svg')).toBeInTheDocument();
    expect(chipFor('vegan').querySelector('svg')?.getAttribute('class')).not.toBe(
      chipFor('sesame').querySelector('svg')?.getAttribute('class'),
    );

    // …and no emoji reaches craft either. Zero of the design screens carry one.
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('keeps BOTH craft actions: Add fast-adds (no forceSheet); Details + title force the sheet', () => {
    const onOpen = jest.fn();
    const { container } = render(<CraftMenuCard item={product} onOpen={onOpen} onFeedbackSuccess={jest.fn()} />);

    // Add to Order: no forceSheet, so a simple product can add straight to the cart.
    fireEvent.click(screen.getByRole('button', { name: 'add_item_to_order(Margherita)' }));
    expect(onOpen).toHaveBeenLastCalledWith(product);

    // Details: forceSheet so the sheet ALWAYS opens to view the item.
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });

    // The dotted-leader title is a view affordance too — forces the sheet, never adds.
    fireEvent.click(container.querySelector('#item-name-p1') as HTMLElement);
    expect(onOpen).toHaveBeenLastCalledWith(product, { forceSheet: true });
  });
});

describe('CraftMenuCard — admin quick-edit', () => {
  afterEach(() => (useOptionalAuth as jest.Mock).mockReturnValue(null));

  it('deep-links an admin to the item editor', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

    render(<CraftMenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-item')).toHaveAttribute('href', '/admin/menu-management/p1');
  });

  it('shows no edit affordance for a guest', () => {
    (useOptionalAuth as jest.Mock).mockReturnValue(null);

    render(<CraftMenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-item')).not.toBeInTheDocument();
  });
});

describe('CraftMenuCard — per-order-type availability (S4)', () => {
  const mockedNotice = useItemAvailabilityNotice as jest.Mock;
  afterEach(() => mockedNotice.mockReturnValue(null));

  const BLOCKED: AvailabilityNotice = {
    tone: 'blocked',
    message: 'Takeaway and Delivery only',
    switchTo: OrderType.Takeaway,
    switchLabel: 'Switch to Takeaway',
    shortMessage: 'Not for Dine-in',
    hint: null,
  };

  it('renders the info chip without dimming or a CTA — parity with the shared card', () => {
    mockedNotice.mockReturnValue({
      tone: 'info',
      message: 'Takeaway and Delivery only',
      switchTo: null,
      switchLabel: '',
      shortMessage: '',
      hint: null,
    } satisfies AvailabilityNotice);

    const { container } = render(<CraftMenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByText('Takeaway and Delivery only')).toBeInTheDocument();
    expect(container.querySelector('li')).not.toHaveClass('blocked');
    expect(screen.getByRole('button', { name: 'add_item_to_order(Margherita)' })).toBeInTheDocument();
  });

  it('dims, names the reason and swaps Add for the switch — the craft half of §4.5', () => {
    const onSwitchOrderType = jest.fn();
    mockedNotice.mockReturnValue(BLOCKED);

    const { container } = render(
      <CraftMenuCard
        item={product}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
        onSwitchOrderType={onSwitchOrderType}
      />,
    );

    const card = container.querySelector('li') as HTMLElement;
    expect(card).toHaveClass('blocked');
    expect(card).toHaveAttribute('aria-labelledby', 'item-name-p1 item-availability-p1');
    expect(screen.queryByRole('button', { name: 'add_item_to_order(Margherita)' })).not.toBeInTheDocument();
    // Details survives — craft must not become a dead end either.
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Takeaway' }));
    expect(onSwitchOrderType).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  // Craft is where the owner noticed items failing to grey out. The greying itself was always
  // implemented here (`.card.blocked`); what was missing is the case below — a server refusal that
  // produces NO notice, because `useItemAvailabilityNotice` returns null for `reason: 'Unavailable'`.
  it('dims and drops Add on a server refusal even when there is no notice to show', () => {
    mockedNotice.mockReturnValue(null);

    const { container } = render(
      <CraftMenuCard
        item={{ ...product, availability: { canOrder: false } as never }}
        onOpen={jest.fn()}
        onFeedbackSuccess={jest.fn()}
      />,
    );

    expect(container.querySelector('li')).toHaveClass('blocked');
    expect(screen.queryByRole('button', { name: 'add_item_to_order(Margherita)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
  });

  it('hands the blocked verdict to analytics too — §4.5, every deliverable lands twice', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<CraftMenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(useTrackItemBlocked).toHaveBeenCalledWith(product.id, BLOCKED);
  });
  it('is addressable as a card, separately from the hero sharing its grid', () => {
    // The Chef's Special is a cell OF the menu grid now, and when the promoted dish is also in the
    // catalogue its hero and its card offer a button with the SAME accessible name ("Add <dish> to
    // order"). Role+name cannot separate them and neither can `data-testid="menu-grid"`, which
    // contains both — so the screenshot suite addresses the card directly. It shipped without this
    // once and the failure was a strict-mode violation in CI, not a red test.
    render(<CraftMenuCard item={product} onOpen={jest.fn()} onFeedbackSuccess={jest.fn()} />);

    expect(screen.getByTestId('menu-card')).toBeInTheDocument();
  });
});
