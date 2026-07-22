import { act, renderHook } from '@testing-library/react';
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

  it('loadEntrancePosition keeps the default when the fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useTableEntrance());

    await act(() => result.current.loadEntrancePosition());

    expect(result.current.entrancePosition).toEqual({ x: 50, y: 10 });
  });

  it('saveEntrancePosition PUTs the current info with the entrance fields changed', async () => {
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
  });

  it('saveEntrancePosition surfaces a save error via showMessage', async () => {
    const showMessage = jest.fn();
    mockGet.mockResolvedValue({ success: true, data: makeInfo() });
    mockUpdate.mockResolvedValue({ success: false, message: 'nope' });
    const { result } = renderHook(() => useTableEntrance(showMessage));

    await act(() => result.current.saveEntrancePosition({ x: 20, y: 80 }));

    expect(showMessage).toHaveBeenCalledWith('error', expect.any(String));
  });
});
