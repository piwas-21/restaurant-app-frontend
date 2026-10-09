import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { useCatalogSheet } from './useCatalogSheet';
import ItemCustomizationSheet from '@/components/menu/ItemCustomizationSheet';
import { getProductById } from '@/services/menuService';
import type { CatalogItem, DetailedProduct, ItemAvailability } from '@/types/menu';
import { OrderType } from '@/types/order';

const mockAddItem = jest.fn().mockResolvedValue(undefined);
const mockNotifyAddFailed = jest.fn();
const mockNotifyItemAdded = jest.fn();
const mockGetProductById = getProductById as jest.Mock;
const mockOrderType = { current: null as OrderType | null };

jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: { orderType: mockOrderType.current }, hydrated: true }),
}));
jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
jest.mock('@/hooks/cart/useCartFeedback', () => ({
  useCartFeedback: () => ({ notifyAddFailed: mockNotifyAddFailed, notifyItemAdded: mockNotifyItemAdded }),
}));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({ useItemAvailabilityNotice: () => null }));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}));
jest.mock('./useBundleCustomizationSheet', () => ({
  useBundleCustomizationSheet: () => ({ kind: 'bundle', openForBundle: jest.fn() }),
}));
jest.mock('./useDrinkUpsell', () => ({
  useDrinkUpsell: () => ({ addSelected: jest.fn(), drinks: [], selected: {}, subtotal: 0 }),
}));

const blocked: ItemAvailability = {
  canOrder: false,
  reason: 'WrongOrderType',
  allowedOrderTypes: [OrderType.Takeaway],
};
const allowed: ItemAvailability = {
  canOrder: true,
  reason: 'Available',
  allowedOrderTypes: [OrderType.Takeaway],
};

const blockedCard: CatalogItem = {
  kind: 'product',
  id: 'p1',
  name: 'Pizza',
  price: 10,
  isBundle: false,
  availability: blocked,
};

function detail(availability: ItemAvailability): DetailedProduct {
  return {
    id: 'p1',
    name: 'Pizza',
    content: { en: { name: 'Pizza' } },
    basePrice: 10,
    variations: [],
    suggestedSideItems: [{ id: 'required-side', name: 'Side', price: 0, isRequired: true, displayOrder: 1 }],
    detailedIngredients: [],
    availability,
  } as unknown as DetailedProduct;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockAddItem.mockClear();
  mockNotifyAddFailed.mockClear();
  mockNotifyItemAdded.mockClear();
  mockGetProductById.mockReset();
  mockOrderType.current = null;
});

describe('catalog-to-sheet availability handoff', () => {
  it('retains an unscoped server-snapshot block through context hydration, then accepts a fresh allowed card', async () => {
    const firstDetail = deferred<{ data: DetailedProduct }>();
    mockGetProductById
      .mockReturnValueOnce(firstDetail.promise)
      .mockResolvedValueOnce({ data: detail(allowed) })
      .mockResolvedValueOnce({ data: detail(allowed) });
    const { result, rerender } = renderHook(() => useCatalogSheet());

    act(() => result.current.openForCatalogItem(blockedCard));
    expect(mockGetProductById).toHaveBeenNthCalledWith(1, 'p1', undefined, null);

    mockOrderType.current = OrderType.DineIn;
    rerender();
    await act(async () => {
      firstDetail.resolve({ data: detail(allowed) });
      await firstDetail.promise;
    });

    await waitFor(() => expect(mockGetProductById).toHaveBeenNthCalledWith(2, 'p1', undefined, OrderType.DineIn));
    await waitFor(() => expect(result.current.product.product?.availability).toEqual(blocked));

    act(() => result.current.product.close());
    mockOrderType.current = OrderType.Takeaway;
    rerender();
    act(() => result.current.openForCatalogItem({ ...blockedCard, availability: allowed }, { forceSheet: true }));

    await waitFor(() => expect(mockGetProductById).toHaveBeenNthCalledWith(3, 'p1', undefined, OrderType.Takeaway));
    await waitFor(() => expect(result.current.product.product?.availability).toEqual(allowed));
  });

  it('uses a fresh channel-scoped detail after opening the blocked card in its selected channel', async () => {
    mockOrderType.current = OrderType.DineIn;
    mockGetProductById
      .mockResolvedValueOnce({ data: detail(allowed) })
      .mockResolvedValueOnce({ data: detail(allowed) });
    const { result, rerender } = renderHook(() => useCatalogSheet());

    act(() => result.current.openForCatalogItem(blockedCard));
    await waitFor(() => expect(mockGetProductById).toHaveBeenNthCalledWith(1, 'p1', undefined, OrderType.DineIn));
    await waitFor(() => expect(result.current.product.product?.availability).toEqual(blocked));

    mockOrderType.current = OrderType.Takeaway;
    rerender();
    await waitFor(() => expect(mockGetProductById).toHaveBeenNthCalledWith(2, 'p1', undefined, OrderType.Takeaway));
    await waitFor(() => expect(result.current.product.product?.availability).toEqual(allowed));
  });

  it('keeps a fresh detail block when the catalog card was allowed and removes Add', async () => {
    const detailBlock: ItemAvailability = {
      canOrder: false,
      reason: 'Unavailable',
      allowedOrderTypes: [],
    };
    mockOrderType.current = OrderType.DineIn;
    mockGetProductById
      .mockResolvedValueOnce({ data: detail(detailBlock) })
      .mockResolvedValueOnce({ data: detail(allowed) });
    const { result, rerender } = renderHook(() => useCatalogSheet());

    act(() => result.current.openForCatalogItem({ ...blockedCard, availability: allowed }));

    await waitFor(() => expect(result.current.product.product?.availability).toEqual(detailBlock));
    render(<ItemCustomizationSheet controller={result.current.product} />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add to Order|add_to_order/ })).not.toBeInTheDocument();
    expect(mockAddItem).not.toHaveBeenCalled();

    mockOrderType.current = OrderType.Takeaway;
    rerender();
    await waitFor(() => expect(mockGetProductById).toHaveBeenNthCalledWith(2, 'p1', undefined, OrderType.Takeaway));
    await waitFor(() => expect(result.current.product.product?.availability).toEqual(allowed));
  });
});
