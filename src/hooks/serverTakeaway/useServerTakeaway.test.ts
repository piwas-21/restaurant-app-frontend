import { act, renderHook, waitFor } from '@testing-library/react';
import type { OrderItem } from '@/components/catalog/orderItems';
import { persistServerTakeawayDraft, readServerTakeawayDraft } from '@/lib/serverTakeawayDraft';
import { reviewServerTakeaway } from './serverTakeawayReview';
import { useServerTakeaway } from './useServerTakeaway';
import { getProductById } from '@/services/menuService';
import { OrderType } from '@/types/order';

jest.mock('./serverTakeawayReview', () => ({ reviewServerTakeaway: jest.fn() }));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('./useServerTakeawayCatalog', () => ({
  useServerTakeawayCatalog: () => ({
    categories: [],
    products: [],
    selectedCategoryId: null,
    setSelectedCategoryId: jest.fn(),
    searchQuery: '',
    setSearchQuery: jest.fn(),
    isLoading: false,
    error: 'server.takeaway.catalog_error',
    retry: jest.fn(),
  }),
}));

const mockReview = reviewServerTakeaway as jest.MockedFunction<typeof reviewServerTakeaway>;
const mockGetProduct = getProductById as jest.Mock;
const item: OrderItem = { product: { id: 'p1', name: 'Tea' }, quantity: 1, unitPrice: 2.5 };

beforeEach(() => {
  window.sessionStorage.clear();
  jest.clearAllMocks();
});

describe('useServerTakeaway operation recovery', () => {
  it('keeps catalogue and order-operation errors in separate channels', async () => {
    const { result } = renderHook(() => useServerTakeaway());
    await waitFor(() => expect(result.current.catalogError).toBe('server.takeaway.catalog_error'));
    expect(result.current.error).toBeNull();
  });

  it('persists the operation id before waiting for the create outcome', async () => {
    persistServerTakeawayDraft({ items: [item] });
    mockReview.mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() => useServerTakeaway());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => {
      void result.current.review();
    });

    await waitFor(() => expect(readServerTakeawayDraft()?.clientOperationId).toBeDefined());
    const persistedId = readServerTakeawayDraft()?.clientOperationId;
    expect(mockReview).toHaveBeenCalledWith(expect.objectContaining({ storedOperationId: persistedId }));
  });

  it('refuses a product whose detail is blocked for takeaway', async () => {
    mockGetProduct.mockResolvedValue({
      success: true,
      data: {
        id: 'p2',
        name: 'Dine-in soup',
        basePrice: 9,
        availability: { canOrder: false, reason: 'WrongOrderType', allowedOrderTypes: [OrderType.DineIn] },
      },
    });
    const { result } = renderHook(() => useServerTakeaway());

    await act(async () => {
      await result.current.tapProduct({
        id: 'p2',
        name: 'Dine-in soup',
        basePrice: 9,
        isActive: true,
        isAvailable: true,
        type: 'mainItem',
      });
    });

    expect(mockGetProduct).toHaveBeenCalledWith('p2', undefined, OrderType.Takeaway);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.error).toBe('server.takeaway.product_unavailable');
  });
});
