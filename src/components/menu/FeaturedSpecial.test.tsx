import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import FeaturedSpecial from './FeaturedSpecial';
import type { FeaturedSpecial as FeaturedSpecialType } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useItemAvailabilityNotice, type AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

jest.mock('@/hooks/menu/useTrackItemBlocked', () => ({ useTrackItemBlocked: jest.fn() }));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
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
