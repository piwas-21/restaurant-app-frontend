import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useFeaturedSpecialHero } from './useFeaturedSpecialHero';
import { useItemAvailabilityNotice } from './useItemAvailabilityNotice';
import type { FeaturedSpecial } from '@/types/menu';
import { OrderType } from '@/types/order';

// Mutable so a case can drive the locale — including the empty one i18next reports before its
// detector has run, which is the arm the two hero component tests cannot reach.
const i18n = { language: 'en' as string | undefined };
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => f ?? k, i18n }),
}));

jest.mock('./useTrackItemBlocked', () => ({ useTrackItemBlocked: jest.fn() }));
jest.mock('./useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
  isItemBlocked: jest.requireActual('./useItemAvailabilityNotice').isItemBlocked,
}));

const special = {
  id: 'p1',
  name: 'Adana Kebab',
  description: 'Charcoal-grilled',
  basePrice: 16.5,
  availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [OrderType.Takeaway] },
  featuredDate: '2026-08-01',
  preparationTimeMinutes: 22,
  variations: [],
  suggestedSideItems: [],
  detailedIngredients: [],
  type: 'mainItem',
} as unknown as FeaturedSpecial;

afterEach(() => {
  i18n.language = 'en';
  (useItemAvailabilityNotice as jest.Mock).mockReturnValue(null);
});

/**
 * The hero's DECISION half, shared by the classic and craft surfaces. It exists because a second
 * copy of this reasoning is what let `CraftMenuCard` and the hero disagree about "blocked" (E6),
 * so the properties worth pinning here are the ones a template must not be able to answer alone.
 */
describe('useFeaturedSpecialHero', () => {
  it('resolves the localized name/description for the active locale', () => {
    i18n.language = 'de';
    const { result } = renderHook(() =>
      useFeaturedSpecialHero({
        ...special,
        content: { de: { name: 'Adana Spieß', description: 'Vom Holzkohlegrill' } },
      } as unknown as FeaturedSpecial),
    );

    expect(result.current.itemName).toBe('Adana Spieß');
    expect(result.current.description).toBe('Vom Holzkohlegrill');
  });

  it('takes the base language from a regional tag — de-CH must resolve the de entry', () => {
    i18n.language = 'de-CH';
    const { result } = renderHook(() =>
      useFeaturedSpecialHero({
        ...special,
        content: { de: { name: 'Adana Spieß', description: '' } },
      } as unknown as FeaturedSpecial),
    );

    expect(result.current.itemName).toBe('Adana Spieß');
  });

  it('falls back to en when i18next reports no language yet', () => {
    // Reachable in the real app: `i18n.language` is undefined until the detector resolves, and on
    // that first render the hero would otherwise index `content[undefined]`.
    i18n.language = undefined;
    const { result } = renderHook(() =>
      useFeaturedSpecialHero({
        ...special,
        content: { en: { name: 'English name', description: 'English description' } },
      } as unknown as FeaturedSpecial),
    );

    expect(result.current.itemName).toBe('English name');
    expect(result.current.description).toBe('English description');
  });

  it('falls back to the base value when neither the active locale nor en has an entry', () => {
    const { result } = renderHook(() => useFeaturedSpecialHero(special));

    expect(result.current.itemName).toBe('Adana Kebab');
    expect(result.current.description).toBe('Charcoal-grilled');
  });

  it('reflects an admin price edit, then resyncs when the special changes underneath it', () => {
    const { result, rerender } = renderHook((s: FeaturedSpecial) => useFeaturedSpecialHero(s), {
      initialProps: special,
    });

    expect(result.current.price).toBe(16.5);

    act(() => result.current.onPriceChange(18));
    expect(result.current.price).toBe(18);

    // A new special must not keep showing the previous one's edited price.
    rerender({ ...special, basePrice: 21 } as FeaturedSpecial);
    expect(result.current.price).toBe(21);
  });

  it('feeds the SERVER verdict into the guard — the link the whole feature hangs on', () => {
    renderHook(() => useFeaturedSpecialHero(special));

    expect(useItemAvailabilityNotice).toHaveBeenCalledWith(special.availability);
  });

  it('blocks on the server verdict even when there is no notice to render for it', () => {
    (useItemAvailabilityNotice as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() =>
      useFeaturedSpecialHero({
        ...special,
        availability: { canOrder: false, reason: 'Unavailable', allowedOrderTypes: [] },
      } as unknown as FeaturedSpecial),
    );

    expect(result.current.isBlocked).toBe(true);
  });

  it('gives the reason paragraph an id scoped to the item, so two heroes could not collide', () => {
    const { result } = renderHook(() => useFeaturedSpecialHero(special));

    expect(result.current.reasonId).toBe('featured-special-availability-p1');
  });
});
