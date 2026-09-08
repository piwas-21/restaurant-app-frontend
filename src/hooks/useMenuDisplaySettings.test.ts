import { renderHook } from '@testing-library/react';
import { useMenuDisplaySettings } from './useMenuDisplaySettings';
import { useRestaurantInfo } from './useRestaurantInfo';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';

/**
 * The settings seam both layouts read. The defaults ARE the feature's safety: while the
 * restaurant-info read is in flight, on a null read, and on any backend that predates the
 * fields, the answer must be tabs + no bundles on All — byte-identical to the shipped
 * behaviour. Pinned here so a refactor cannot quietly invert an absent value.
 */
jest.mock('./useRestaurantInfo', () => ({ useRestaurantInfo: jest.fn() }));
const mockUseRestaurantInfo = useRestaurantInfo as jest.Mock;

function infoFixture(overrides: Partial<RestaurantInfoDto> = {}): RestaurantInfoDto {
  return {
    id: 'id-1',
    name: 'Rumi',
    addressLine1: 'Rue X 1',
    addressLine2: null,
    city: 'Genève',
    postalCode: '1202',
    country: 'Switzerland',
    latitude: null,
    longitude: null,
    email: 'contact@rumirestaurant.ch',
    website: null,
    themePaletteKey: null,
    logoUrl: null,
    logoDarkUrl: null,
    interiorImageUrl: null,
    phoneNumbers: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRestaurantInfo.mockReturnValue({ info: null, isLoading: true, error: null, refetch: jest.fn() });
});

describe('useMenuDisplaySettings — defaults are the shipped behaviour', () => {
  it('answers tabs / no-bundles while the read is in flight', () => {
    const { result } = renderHook(() => useMenuDisplaySettings());
    expect(result.current.menuLayout).toBe('tabs');
    expect(result.current.showBundlesOnAllTab).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('answers tabs / no-bundles when the read failed (info null)', () => {
    mockUseRestaurantInfo.mockReturnValue({
      info: null,
      isLoading: false,
      error: new Error('down'),
      refetch: jest.fn(),
    });
    const { result } = renderHook(() => useMenuDisplaySettings());
    expect(result.current.menuLayout).toBe('tabs');
    expect(result.current.showBundlesOnAllTab).toBe(false);
  });

  it('reads absent fields as the defaults — a pre-settings backend changes nothing', () => {
    const partial = { ...infoFixture() } as Partial<RestaurantInfoDto>;
    delete partial.menuLayout;
    delete partial.showMenuBundlesOnAllTab;
    mockUseRestaurantInfo.mockReturnValue({
      info: partial as RestaurantInfoDto,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { result } = renderHook(() => useMenuDisplaySettings());
    expect(result.current.menuLayout).toBe('tabs');
    expect(result.current.showBundlesOnAllTab).toBe(false);
  });

  it("passes the tenant's choices through when present", () => {
    mockUseRestaurantInfo.mockReturnValue({
      info: infoFixture({ menuLayout: 'onepage', showMenuBundlesOnAllTab: true }),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { result } = renderHook(() => useMenuDisplaySettings());
    expect(result.current.menuLayout).toBe('onepage');
    expect(result.current.showBundlesOnAllTab).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('reads an unknown layout value as tabs, never as one-page', () => {
    // A typo can only reach the store through a non-validating writer; the guest side
    // must fall safe to the shipped layout.
    mockUseRestaurantInfo.mockReturnValue({
      info: infoFixture({ menuLayout: 'page' as RestaurantInfoDto['menuLayout'] }),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { result } = renderHook(() => useMenuDisplaySettings());
    expect(result.current.menuLayout).toBe('tabs');
  });
});
