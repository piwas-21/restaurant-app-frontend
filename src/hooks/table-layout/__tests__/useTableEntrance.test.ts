import { act, renderHook } from '@testing-library/react';
import { invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import { getRestaurantInfo, updateRestaurantInfo } from '@/services/restaurantInfoService';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';
import { useTableEntrance } from '../useTableEntrance';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

jest.mock('@/services/restaurantInfoService', () => ({
  getRestaurantInfo: jest.fn(),
  updateRestaurantInfo: jest.fn(),
}));

jest.mock('@/hooks/useRestaurantInfo', () => ({
  invalidateRestaurantInfoCache: jest.fn(),
}));

const mockGet = getRestaurantInfo as jest.Mock;
const mockUpdate = updateRestaurantInfo as jest.Mock;

const makeInfo = (overrides: Partial<RestaurantInfoDto> = {}): RestaurantInfoDto => ({
  id: 'r1',
  name: 'RUMI',
  addressLine1: 'Rue du Test 1',
  addressLine2: null,
  city: 'Geneva',
  postalCode: '1200',
  country: 'CH',
  latitude: null,
  longitude: null,
  email: 'info@example.com',
  website: null,
  themePaletteKey: null,
  phoneNumbers: [],
  ...overrides,
});

describe('useTableEntrance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to { x: 50, y: 10 } before any load', () => {
    const { result } = renderHook(() => useTableEntrance());
    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
  });

  it('loadEntrancePosition reads the position from restaurant info', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: makeInfo({ entrancePositionX: 12, entrancePositionY: 34 }),
    });
    const { result } = renderHook(() => useTableEntrance());

    await act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 12, y: 34 });
  });

  it('loadEntrancePosition keeps the default when the fields are null/absent (pre-backend)', async () => {
    mockGet.mockResolvedValue({ success: true, data: makeInfo({ entrancePositionX: null }) });
    const { result } = renderHook(() => useTableEntrance());

    await act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
  });

  it('loadEntrancePosition keeps the default AND tells the admin when the fetch fails', async () => {
    const showMessage = jest.fn();
    mockGet.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useTableEntrance(showMessage));

    await act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
    expect(showMessage).toHaveBeenCalledWith('error', 'Failed to load restaurant info');
  });

  it('saveEntrancePosition PUTs the current info with the entrance fields changed and invalidates the customer-map cache', async () => {
    mockGet.mockResolvedValue({ success: true, data: makeInfo() });
    mockUpdate.mockResolvedValue({ success: true, data: makeInfo() });
    const { result } = renderHook(() => useTableEntrance());

    await act(() => result.current.saveEntrancePosition({ x: 20, y: 80 }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'RUMI',
        email: 'info@example.com',
        entrancePositionX: 20,
        entrancePositionY: 80,
      }),
    );
    // Customer-map staleness guard: without this the map serves the cached
    // (pre-save) position for up to the cache TTL.
    expect(invalidateRestaurantInfoCache).toHaveBeenCalledTimes(1);
  });

  it('a failed save surfaces the SERVER message and reverts to the last server-confirmed position', async () => {
    const showMessage = jest.fn();
    mockGet.mockResolvedValue({
      success: true,
      data: makeInfo({ entrancePositionX: 12, entrancePositionY: 34 }),
    });
    mockUpdate.mockResolvedValue({ success: false, message: 'Entrance position out of range' });
    const { result } = renderHook(() => useTableEntrance(showMessage));

    // Load establishes the server-confirmed position; the drag then moves the
    // local marker before the (failing) save.
    await act(() => result.current.loadEntrancePosition());
    act(() => result.current.setEntrancePosition({ x: 20, y: 80 }));
    await act(() => result.current.saveEntrancePosition({ x: 20, y: 80 }));

    expect(showMessage).toHaveBeenCalledWith('error', 'Entrance position out of range');
    expect(result.current.entrancePosition).toEqual({ x: 12, y: 34 });
    expect(invalidateRestaurantInfoCache).not.toHaveBeenCalled();
  });

  it('a save that cannot fetch the current info falls back to the generic message and reverts', async () => {
    const showMessage = jest.fn();
    mockGet.mockResolvedValue({ success: true, data: null });
    const { result } = renderHook(() => useTableEntrance(showMessage));

    act(() => result.current.setEntrancePosition({ x: 20, y: 80 }));
    await act(() => result.current.saveEntrancePosition({ x: 20, y: 80 }));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith('error', 'Failed to save layout');
    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
  });
});
