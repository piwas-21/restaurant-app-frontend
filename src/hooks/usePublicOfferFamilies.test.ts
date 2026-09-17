import { act, renderHook, waitFor } from '@testing-library/react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getCatalogOfferFamilies } from '@/services/catalogService';
import type { CatalogOfferFamilyResponse } from '@/types/menu/offerFamily';
import { usePublicOfferFamilies } from './usePublicOfferFamilies';

jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/services/catalogService', () => ({ getCatalogOfferFamilies: jest.fn() }));

const mockOrderType = useOrderType as jest.Mock;
const mockGetCatalogOfferFamilies = getCatalogOfferFamilies as jest.Mock;

const pageOne: CatalogOfferFamilyResponse = {
  success: true,
  data: {
    items: [
      {
        id: 'family-one',
        anchor: { productId: 'dish-one', name: 'Dish one', price: 8, kind: 'product' },
        categoryIds: ['cat-main'],
        startingPrice: 8,
      },
    ],
    page: 1,
    pageSize: 100,
    totalCount: 101,
    totalPages: 2,
  },
};

const pageTwo: CatalogOfferFamilyResponse = {
  success: true,
  data: {
    items: [
      {
        id: 'family-two',
        anchor: { productId: 'dish-two', name: 'Dish two', price: 9, kind: 'product' },
        categoryIds: ['cat-main'],
        startingPrice: 9,
      },
    ],
    page: 2,
    pageSize: 100,
    totalCount: 101,
    totalPages: 2,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOrderType.mockReturnValue({ state: { orderType: null }, hydrated: true });
  mockGetCatalogOfferFamilies.mockResolvedValue(pageOne);
});

describe('usePublicOfferFamilies — bounded guest pagination', () => {
  it('loads only the first server page instead of materializing the full catalogue', async () => {
    const { result } = renderHook(() => usePublicOfferFamilies(true));

    await waitFor(() => expect(result.current.families).toHaveLength(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetCatalogOfferFamilies).toHaveBeenCalledTimes(1);
    expect(mockGetCatalogOfferFamilies).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      requestedOrderType: null,
      signal: expect.any(AbortSignal),
    });
    expect(result.current.totalPages).toBe(2);
    expect(result.current.totalCount).toBe(101);
  });

  it('fetches a later page only when the guest requests it', async () => {
    mockGetCatalogOfferFamilies.mockResolvedValueOnce(pageOne).mockResolvedValueOnce(pageTwo);
    const { result } = renderHook(() => usePublicOfferFamilies(true));
    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-one'));

    await act(async () => {
      result.current.onPageChange(2);
    });

    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-two'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetCatalogOfferFamilies).toHaveBeenCalledTimes(2);
    expect(mockGetCatalogOfferFamilies).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 100,
      requestedOrderType: null,
      signal: expect.any(AbortSignal),
    });
  });

  it('ignores page requests outside the server-reported range', async () => {
    const { result } = renderHook(() => usePublicOfferFamilies(true));
    await waitFor(() => expect(result.current.families).toHaveLength(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onPageChange(3);
    });

    expect(mockGetCatalogOfferFamilies).toHaveBeenCalledTimes(1);
  });
});
