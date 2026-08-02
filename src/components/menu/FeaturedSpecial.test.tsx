import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import FeaturedSpecial from './FeaturedSpecial';
import type { FeaturedSpecial as FeaturedSpecialType } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useItemAvailabilityNotice, type AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';
import { useIsAdmin } from '@/hooks/menu/useIsAdmin';

jest.mock('react-i18next', () => ({
  // `i18n` is needed now that the hero resolves its localized name/description from `content`, as
  // every catalog card already did — the classic hero used to print the base (English) value in
  // every locale.
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key, i18n: { language: 'en' } }),
}));

// The admin controls render nothing for a guest, which is the state every existing case below
// assumes. Cases that need an admin re-mock this.
jest.mock('@/hooks/menu/useIsAdmin', () => ({ useIsAdmin: jest.fn(() => false) }));

jest.mock('@/hooks/menu/useTrackItemBlocked', () => ({ useTrackItemBlocked: jest.fn() }));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
  // The predicate is deliberately NOT stubbed. It is the thing under test here — the three item
  // surfaces diverged precisely because each derived "blocked" for itself, and a mock would let
  // that happen again invisibly.
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
  name: 'Chef Special',
  basePrice: 24,
  availability: AVAILABILITY,
  featuredDate: '2026-07-27',
  preparationTimeMinutes: 0,
  variations: [],
  suggestedSideItems: [],
  detailedIngredients: [],
} as unknown as FeaturedSpecialType;

/**
 * The description branch. It was COMMENTED OUT rather than deleted until 2026-08-02, which is why
 * the hero read as a photo, a name and a price — tall because of the image and empty because its
 * copy was switched off. Both sides are covered because restoring it introduced a branch, and the
 * per-file coverage pin caught that before CI would have let it through.
 */
describe('the restored description', () => {
  it('renders it when the special has one', () => {
    render(
      <FeaturedSpecial
        special={{ ...special, description: 'Slow-braised lamb with pomegranate' } as FeaturedSpecialType}
        onAddToCart={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );
    expect(screen.getByText('Slow-braised lamb with pomegranate')).toBeInTheDocument();
  });

  it('renders nothing in its place when the special has none', () => {
    const { container } = render(
      <FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />,
    );
    // Not an empty <p>: an element with no text is still a gap in the layout.
    expect(container.querySelector('[class*="featuredSpecialDescription"]')).toBeNull();
  });
});

const BLOCKED: AvailabilityNotice = {
  tone: 'blocked',
  message: 'Takeaway and Delivery only',
  switchTo: OrderType.Takeaway,
  switchLabel: 'Switch to Takeaway',
  hint: null,
};

const INFO: AvailabilityNotice = { ...BLOCKED, tone: 'info', switchTo: null, switchLabel: '' };

afterEach(() => mockedNotice.mockReturnValue(null));

describe('FeaturedSpecial — per-order-type guard (G7)', () => {
  it('offers Add when the server reports no restriction', () => {
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Add to Order' })).toBeInTheDocument();
    expect(screen.queryByText('Takeaway and Delivery only')).not.toBeInTheDocument();
  });

  it('info tone: names the restriction but keeps the hero fully orderable', () => {
    mockedNotice.mockReturnValue(INFO);

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByText('Takeaway and Delivery only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Order' })).toBeInTheDocument();
  });

  it('blocked tone: REMOVES Add, keeps Details, and offers the switch', () => {
    // Removed rather than disabled — the S4 rule: nothing focusable-but-dead, and the switch is the
    // way out. Details stays because it only SHOWS the item.
    mockedNotice.mockReturnValue(BLOCKED);
    const onSwitchOrderType = jest.fn();

    render(
      <FeaturedSpecial
        special={special}
        onAddToCart={jest.fn()}
        onViewDetails={jest.fn()}
        onSwitchOrderType={onSwitchOrderType}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Add to Order' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Takeaway' }));
    expect(onSwitchOrderType).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  it('folds the reason into the section’s accessible name while blocked', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.getByRole('region', { name: /Chef Special Takeaway and Delivery only/ })).toBeInTheDocument();
  });

  it('reports the blocked hero under its OWN source, so it cannot swallow the card’s event', () => {
    mockedNotice.mockReturnValue(BLOCKED);

    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(useTrackItemBlocked).toHaveBeenCalledWith('p1', BLOCKED, 'featured_special');
  });

  it('feeds the SERVER verdict into the guard — the one link this whole feature hangs on', () => {
    // Without this, mocking the hook lets the banner stop reading `special.availability` entirely
    // and every other test here still passes.
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(useItemAvailabilityNotice).toHaveBeenCalledWith(AVAILABILITY);
  });

  it('refuses an UNAVAILABLE special even though there is no notice to show for it', () => {
    // `useItemAvailabilityNotice` returns null for `reason: 'Unavailable'`, and unlike a card this
    // hero is not filtered out upstream — the featured query filters on IsActive, never
    // IsAvailable. Gating on the notice alone would offer Add on an item the server refuses.
    mockedNotice.mockReturnValue(null);
    const unavailable = {
      ...special,
      availability: { canOrder: false, reason: 'Unavailable', allowedOrderTypes: [] },
    } as unknown as FeaturedSpecialType;

    render(<FeaturedSpecial special={unavailable} onAddToCart={jest.fn()} onViewDetails={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Add to Order' })).not.toBeInTheDocument();
  });

  it('hands the verdict to BOTH buttons — the §9.10 hand-over lives in the banner, not the page', () => {
    const onAddToCart = jest.fn();
    const onViewDetails = jest.fn();

    render(<FeaturedSpecial special={special} onAddToCart={onAddToCart} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add to Order' }));
    expect(onAddToCart).toHaveBeenCalledWith({ availability: AVAILABILITY });

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    // Details forces the sheet — it must SHOW the item, never quick-add it.
    expect(onViewDetails).toHaveBeenCalledWith({ forceSheet: true, availability: AVAILABILITY });
  });
});

/**
 * E4 sub-issue 2. `MenuCard` and `CraftMenuCard` both render `AdminMenuCardControls` +
 * `AdminPriceEditor`; the hero rendered neither — so an admin could edit the price of every item on
 * the page except the one the page is promoting.
 */
describe('admin controls on the hero', () => {
  const asAdmin = (yes: boolean) => (useIsAdmin as jest.Mock).mockReturnValue(yes);
  afterEach(() => asAdmin(false));

  it('renders nothing extra for a guest — the controls are not merely hidden by CSS', () => {
    asAdmin(false);
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-item')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-edit-price-locked')).not.toBeInTheDocument();
  });

  it('gives an admin the deep link into the item editor', () => {
    asAdmin(true);
    render(<FeaturedSpecial special={special} onAddToCart={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-item')).toHaveAttribute('href', '/admin/menu-management/p1');
  });

  it('offers the inline price edit when the special is a plain product', () => {
    asAdmin(true);
    render(<FeaturedSpecial special={{ ...special, type: 'mainItem' }} onAddToCart={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-price')).toBeInTheDocument();
  });

  it('refuses WITH A REASON for a featured combo instead of rendering nothing', () => {
    // Rendering nothing is what made this look like a bug in the first place (E3): an absence with
    // no explanation is indistinguishable from a defect.
    asAdmin(true);
    render(<FeaturedSpecial special={{ ...special, type: 'menu' }} onAddToCart={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-edit-price-locked')).toBeInTheDocument();
  });

  it('refuses when the backend sent no type — the additive-field ordering case', () => {
    asAdmin(true);
    render(<FeaturedSpecial special={{ ...special, type: undefined }} onAddToCart={jest.fn()} />);

    expect(screen.getByTestId('admin-edit-price-locked')).toHaveTextContent('Open the item to edit its price');
  });
});

describe('localized content', () => {
  it('prefers the active locale over the base name — the hero used to print English in every locale', () => {
    render(
      <FeaturedSpecial
        special={{ ...special, content: { en: { name: 'Chef Special', description: 'Base' } } }}
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Chef Special' })).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
  });
});

describe('the optional blocks', () => {
  it('renders the photo, the prep time and the allergen list when the special has them', () => {
    render(
      <FeaturedSpecial
        special={
          {
            ...special,
            imageUrl: '/uploads/kebab.jpg',
            preparationTimeMinutes: 22,
            allergens: ['gluten'],
          } as FeaturedSpecialType
        }
        onAddToCart={jest.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Chef Special' })).toBeInTheDocument();
    expect(screen.getByText(/22/)).toBeInTheDocument();
    expect(screen.getByText(/gluten/i)).toBeInTheDocument();
  });

  it('renders none of them when it has none — an empty frame is worse than no frame', () => {
    const { container } = render(
      <FeaturedSpecial special={{ ...special, allergens: [] } as FeaturedSpecialType} onAddToCart={jest.fn()} />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="featuredSpecialAllergens"]')).toBeNull();
    expect(container.querySelector('[class*="featuredSpecialTime"]')).toBeNull();
  });
});
