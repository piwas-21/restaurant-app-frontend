import { renderHook } from '@testing-library/react';
import { useCategoryTabs } from './useCategoryTabs';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import type { ApiCategory } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';

// Mock t returns the key (or interpolates the fallback), so no translation "exists" —
// getCategoryDisplayName then falls back to the raw API category name (its documented behaviour).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown, vars?: Record<string, string>) => {
      const template = typeof fallback === 'string' ? fallback : key;
      if (!vars) return template;
      return Object.entries(vars).reduce((out, [name, value]) => out.replaceAll(`{{${name}}}`, value), template);
    },
  }),
}));

jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({ useEnabledOrderTypes: jest.fn() }));

const mockOrderType = useOrderType as jest.Mock;
const mockEnabled = useEnabledOrderTypes as jest.Mock;

const ALL: OrderType[] = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];

const cat = (id: string, name: string, allowedOrderTypes?: OrderType[]) =>
  ({ id, name, allowedOrderTypes }) as unknown as ApiCategory;

function setup({
  orderType = null,
  enabled = ALL,
  loading = false,
}: { orderType?: OrderType | null; enabled?: OrderType[]; loading?: boolean } = {}) {
  mockOrderType.mockReturnValue({ state: { orderType } });
  mockEnabled.mockReturnValue({ enabled, loading });
}

describe('useCategoryTabs', () => {
  const categories = [cat('c1', 'Grills'), cat('c2', 'Soups')];

  beforeEach(() => setup());

  it('prepends All + Menu Bundles, then each category in order', () => {
    const { result } = renderHook(() => useCategoryTabs(categories, 'All'));
    expect(result.current.map((tab) => tab.id)).toEqual([ALL_ITEMS_KEY, MENU_BUNDLES_KEY, 'c1', 'c2']);
  });

  it('uses the provided all-label and the menu_bundles key for the fixed tabs', () => {
    const { result } = renderHook(() => useCategoryTabs(categories, 'Everything'));
    expect(result.current[0]).toEqual({ id: ALL_ITEMS_KEY, label: 'Everything', notice: null });
    expect(result.current[1]).toEqual({ id: MENU_BUNDLES_KEY, label: 'menu_bundles', notice: null });
  });

  it('labels categories via getCategoryDisplayName (falls back to the API name)', () => {
    const { result } = renderHook(() => useCategoryTabs(categories, 'All'));
    expect(result.current[2]).toEqual({ id: 'c1', label: 'Grills', notice: null });
    expect(result.current[3]).toEqual({ id: 'c2', label: 'Soups', notice: null });
  });

  it('returns just the two fixed tabs when there are no categories', () => {
    const { result } = renderHook(() => useCategoryTabs([], 'All'));
    expect(result.current).toHaveLength(2);
  });
});

describe('useCategoryTabs — channel restriction chip (§4.4)', () => {
  const restricted = [cat('c1', 'Wraps', [OrderType.Takeaway, OrderType.Delivery])];

  it('carries a neutral chip when no channel is chosen', () => {
    setup({ orderType: null });
    const { result } = renderHook(() => useCategoryTabs(restricted, 'All'));

    expect(result.current[2].notice).toEqual({ message: 'Takeaway and Delivery only' });
  });

  it('keeps stating the restriction once a channel the category refuses is chosen', () => {
    setup({ orderType: OrderType.DineIn });
    const { result } = renderHook(() => useCategoryTabs(restricted, 'All'));

    expect(result.current[2].notice).toEqual({ message: 'Takeaway and Delivery only' });
  });

  it('says nothing once a channel the category permits is chosen', () => {
    setup({ orderType: OrderType.Takeaway });
    const { result } = renderHook(() => useCategoryTabs(restricted, 'All'));

    expect(result.current[2].notice).toBeNull();
  });

  it('says nothing for an unrestricted category', () => {
    setup({ orderType: OrderType.DineIn });
    const { result } = renderHook(() => useCategoryTabs([cat('c1', 'Grills', ALL)], 'All'));

    expect(result.current[2].notice).toBeNull();
  });

  it('says nothing when the backend omits the decoded list (absent = unrestricted, never blocked)', () => {
    setup({ orderType: OrderType.DineIn });
    const { result } = renderHook(() => useCategoryTabs([cat('c1', 'Grills')], 'All'));

    expect(result.current[2].notice).toBeNull();
  });

  it('says nothing while the enabled-channel list is still loading', () => {
    setup({ orderType: OrderType.DineIn, loading: true });
    const { result } = renderHook(() => useCategoryTabs(restricted, 'All'));

    expect(result.current[2].notice).toBeNull();
  });

  it('states only channels the admin has switched on', () => {
    // Delivery is off restaurant-wide, so a Takeaway+Delivery category reads simply "Takeaway only".
    setup({ orderType: OrderType.DineIn, enabled: [OrderType.DineIn, OrderType.Takeaway] });
    const { result } = renderHook(() => useCategoryTabs(restricted, 'All'));

    expect(result.current[2].notice).toEqual({ message: 'Takeaway only' });
  });

  it('never chips the All / Menu Bundles tabs — "All items" must not look broken', () => {
    setup({ orderType: OrderType.DineIn });
    const { result } = renderHook(() => useCategoryTabs(restricted, 'All'));

    expect(result.current[0].notice).toBeNull();
    expect(result.current[1].notice).toBeNull();
  });

  it('reads "Unavailable" when every channel the category allows is admin-disabled', () => {
    // Delivery-only category, Delivery switched off restaurant-wide, guest on Dine-in: there is no
    // channel left to name, and the card for an inheriting product says exactly the same word.
    setup({ orderType: OrderType.DineIn, enabled: [OrderType.DineIn, OrderType.Takeaway] });
    const { result } = renderHook(() => useCategoryTabs([cat('c1', 'Platters', [OrderType.Delivery])], 'All'));

    expect(result.current[2].notice).toEqual({ message: 'Unavailable' });
  });

  it('says nothing when the admin-enabled list came back empty (treated as "no preference set")', () => {
    setup({ orderType: OrderType.DineIn, enabled: [] });
    const { result } = renderHook(() => useCategoryTabs(restricted, 'All'));

    expect(result.current[2].notice).toBeNull();
  });
});
