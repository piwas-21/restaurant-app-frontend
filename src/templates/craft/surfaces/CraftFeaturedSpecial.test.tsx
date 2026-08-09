import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CraftFeaturedSpecial from './CraftFeaturedSpecial';
import type { FeaturedSpecial as FeaturedSpecialType } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useItemAvailabilityNotice, type AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useIsAdmin } from '@/hooks/menu/useIsAdmin';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    // Matches the classic surfaces' mock so the two hero tests read alike: a string second arg is
    // a dev fallback and wins; an OBJECT second arg is i18next's interpolation options, and is
    // rendered as `key(values)` so an assertion can prove which values reached it.
    t: (key: string, arg?: unknown) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object') return `${key}(${Object.values(arg).join(',')})`;
      return key;
    },
  }),
}));

jest.mock('@/hooks/menu/useIsAdmin', () => ({ useIsAdmin: jest.fn(() => false) }));
jest.mock('@/hooks/menu/useTrackItemBlocked', () => ({ useTrackItemBlocked: jest.fn() }));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
  // Not stubbed, for the same reason the classic hero's test does not stub it: the predicate is
  // exactly what diverged between these surfaces, and a mock would let it diverge again invisibly.
  isItemBlocked: jest.requireActual('@/hooks/menu/useItemAvailabilityNotice').isItemBlocked,
}));

const mockedNotice = useItemAvailabilityNotice as jest.Mock;

const AVAILABILITY = {
  canOrder: true,
  reason: 'Available',
  allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
} as const;

const special = {
  id: 'p1',
  name: 'Adana Kebab',
  description: 'Charcoal-grilled',
  basePrice: 16.5,
  availability: AVAILABILITY,
  featuredDate: '2026-08-01',
  preparationTimeMinutes: 22,
  variations: [],
  suggestedSideItems: [],
  detailedIngredients: [],
  type: 'mainItem',
} as unknown as FeaturedSpecialType;

const BLOCKED: AvailabilityNotice = {
  tone: 'blocked',
  message: 'Takeaway and Delivery only',
  switchTo: OrderType.Takeaway,
  switchLabel: 'Switch to Takeaway',
  shortMessage: 'Not for Dine-in',
  hint: null,
};

afterEach(() => {
  mockedNotice.mockReturnValue(null);
  (useIsAdmin as jest.Mock).mockReturnValue(false);
});

/**
 * Craft's hero was the missing counterpart: until now the banner rendered the CLASSIC gold card in
 * both templates, above a kraft-paper menu board it shared no vocabulary with. Every case here is
 * the craft half of a rule the classic hero is already held to — because the point of the shared
 * `useFeaturedSpecialHero` is that these two cannot answer them differently.
 */
describe('CraftFeaturedSpecial', () => {
  it('renders the dish and its price on the hand-lettered leader', () => {
    render(<CraftFeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Adana Kebab' })).toBeInTheDocument();
    expect(screen.getByText(/16\.50/)).toBeInTheDocument();
    expect(screen.getByText('Charcoal-grilled')).toBeInTheDocument();
  });

  it('offers Add when the server reports no restriction', () => {
    render(<CraftFeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'add_item_to_order(Adana Kebab)' })).toBeInTheDocument();
  });

  it('blocked: REMOVES Add, keeps Details, and offers the switch — parity with the classic hero', () => {
    mockedNotice.mockReturnValue(BLOCKED);
    const onSwitchOrderType = jest.fn();

    render(
      <CraftFeaturedSpecial
        special={special}
        onAddToCart={jest.fn()}
        onViewDetails={jest.fn()}
        onSwitchOrderType={onSwitchOrderType}
      />,
    );

    expect(screen.queryByRole('button', { name: 'add_item_to_order(Adana Kebab)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'menu_item_details_aria(Adana Kebab)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Takeaway' }));
    expect(onSwitchOrderType).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  it('refuses an UNAVAILABLE special even though there is no notice to show for it', () => {
    // The E6 defect, in the surface where it was reported: deriving "blocked" from the notice alone
    // leaves a live "Add to Order" on an item the server has already refused.
    mockedNotice.mockReturnValue(null);
    const unavailable = {
      ...special,
      availability: { canOrder: false, reason: 'Unavailable', allowedOrderTypes: [] },
    } as unknown as FeaturedSpecialType;

    render(<CraftFeaturedSpecial special={unavailable} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'add_item_to_order(Adana Kebab)' })).not.toBeInTheDocument();
  });

  it('folds the reason into the section’s accessible name while blocked', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<CraftFeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('region', { name: /Adana Kebab Takeaway and Delivery only/ })).toBeInTheDocument();
  });

  it('hands the server verdict to BOTH buttons, so the sheet refuses what the hero refused', () => {
    const onAddToCart = jest.fn();
    const onViewDetails = jest.fn();

    render(<CraftFeaturedSpecial special={special} onAddToCart={onAddToCart} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'add_item_to_order(Adana Kebab)' }));
    fireEvent.click(screen.getByRole('button', { name: 'menu_item_details_aria(Adana Kebab)' }));

    expect(onAddToCart).toHaveBeenCalledWith({ availability: AVAILABILITY });
    expect(onViewDetails).toHaveBeenCalledWith({ forceSheet: true, availability: AVAILABILITY });
  });

  it('renders the admin controls for an admin and nothing for a guest', () => {
    const { rerender } = render(<CraftFeaturedSpecial special={special} onAddToCart={jest.fn()} />);
    expect(screen.queryByTestId('admin-edit-item')).not.toBeInTheDocument();

    (useIsAdmin as jest.Mock).mockReturnValue(true);
    rerender(<CraftFeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-item')).toHaveAttribute('href', '/admin/menu-management/p1');
    expect(screen.getByTestId('admin-edit-price')).toBeInTheDocument();
  });

  it('marks the special with the NEUTRAL tape, not the saffron one a blocked item wears', () => {
    // Saffron on the featured marker would make "featured" and "unavailable" read as the same
    // object — the collision BUGS-IMPROVEMENTS-PLAN E6 was corrected for wrongly claiming existed.
    // Asserting on the composed class is the only way to see it from jsdom, which loads no CSS.
    const { container } = render(<CraftFeaturedSpecial special={special} onAddToCart={jest.fn()} />);
    const tape = screen.getByText("Chef's Special");

    expect(tape.className).toMatch(/tape/);
    expect(tape.className).not.toMatch(/Accent/);
    expect(container.querySelector('[class*="blocked"]')).toBeNull();
  });

  it('falls back to the placeholder when the special has no image, rather than omitting the photo', () => {
    // The REVERSE of what this asserted until 2026-08-09, and the reversal is the point. Omitting
    // the block was defensible on its own terms — "a taped-up photo border with nothing in it is
    // worse than no photo" — but not in context: every CARD in the grid below falls back to the
    // same placeholder, so the one dish the page promotes was the only item on the page with no
    // picture at all. The classic hero was fixed for this a day earlier; craft had not been, which
    // is the concrete form of the owner's "craft doesn't even have the classic improvements".
    render(<CraftFeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    const img = screen.getByRole('img', { name: 'Adana Kebab' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('placeholder');
  });

  it('renders the photo when there is one', () => {
    render(
      <CraftFeaturedSpecial
        special={{ ...special, imageUrl: '/uploads/adana.jpg' } as FeaturedSpecialType}
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Adana Kebab' })).toBeInTheDocument();
  });

  it('drops the prep-time line when the special has no prep time', () => {
    render(
      <CraftFeaturedSpecial
        special={{ ...special, preparationTimeMinutes: 0 } as FeaturedSpecialType}
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it('omits each action the page did not wire, rather than rendering a dead control', () => {
    render(<CraftFeaturedSpecial special={special} />);

    expect(screen.queryByRole('button', { name: 'add_item_to_order(Adana Kebab)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'menu_item_details_aria(Adana Kebab)' })).not.toBeInTheDocument();
  });
});

/**
 * The hook is shared, so it is exercised from both hero tests. This one pins the locale arms,
 * because the classic hero's test mocks a fixed `language` and craft's is the only place the
 * fallback is reachable.
 */
describe('useFeaturedSpecialHero — locale resolution', () => {
  it('prefers the active locale, then en, then the base value', () => {
    render(
      <CraftFeaturedSpecial
        special={
          {
            ...special,
            name: 'base name',
            description: 'base description',
            content: { en: { name: 'English name', description: 'English description' } },
          } as FeaturedSpecialType
        }
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'English name' })).toBeInTheDocument();
    expect(screen.getByText('English description')).toBeInTheDocument();
  });

  it('falls back to the base value when the active locale has no entry', () => {
    render(
      <CraftFeaturedSpecial
        special={{ ...special, content: { de: { name: 'Deutsch', description: '' } } } as FeaturedSpecialType}
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Adana Kebab' })).toBeInTheDocument();
  });
});
