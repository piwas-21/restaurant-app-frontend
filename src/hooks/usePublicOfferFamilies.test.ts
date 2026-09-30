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
  window.history.replaceState({}, '', '/');
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
      categoryId: null,
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
      categoryId: null,
      requestedOrderType: null,
      signal: expect.any(AbortSignal),
    });
  });

  it('keeps category-offer pagination in the URL and restores it on browser history navigation', async () => {
    window.history.replaceState({}, '', '/fr/menu?qr=table-token');
    mockGetCatalogOfferFamilies
      .mockResolvedValueOnce(pageOne)
      .mockResolvedValueOnce(pageTwo)
      .mockResolvedValueOnce(pageOne);
    const { result } = renderHook(() => usePublicOfferFamilies(true));
    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-one'));

    await act(async () => result.current.onPageChange(2));
    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-two'));
    expect(window.location.pathname + window.location.search).toBe('/fr/menu?qr=table-token&page=2');

    // A browser back event restores the prior address before listeners fetch that page again.
    window.history.replaceState({}, '', '/fr/menu?qr=table-token');
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-one'));
    expect(result.current.currentPage).toBe(1);
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

  it('passes a selected category to the server so tab counts exclude other categories', async () => {
    const { result } = renderHook(() => usePublicOfferFamilies(true, 'cat-main'));

    await waitFor(() => expect(result.current.families).toHaveLength(1));

    expect(mockGetCatalogOfferFamilies).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      categoryId: 'cat-main',
      requestedOrderType: null,
      signal: expect.any(AbortSignal),
    });
  });

  it('preserves a selected category through offer pagination and browser history', async () => {
    window.history.replaceState({}, '', '/fr/menu?qr=table-token&categoryId=cat-main');
    mockGetCatalogOfferFamilies
      .mockResolvedValueOnce(pageOne)
      .mockResolvedValueOnce(pageTwo)
      .mockResolvedValueOnce(pageOne);
    const { result } = renderHook(() => usePublicOfferFamilies(true, 'cat-main'));
    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-one'));

    await act(async () => result.current.onPageChange(2));
    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-two'));
    expect(window.location.pathname + window.location.search).toBe(
      '/fr/menu?qr=table-token&page=2&categoryId=cat-main',
    );

    window.history.replaceState({}, '', '/fr/menu?qr=table-token&categoryId=cat-main');
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    await waitFor(() => expect(result.current.families[0]?.id).toBe('family-one'));
    expect(result.current.currentPage).toBe(1);
  });
});
