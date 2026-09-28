import { renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import type { Product } from '@/app/admin/menu-management/interfaces';
import type { MenuSection } from '@/types/menu';
import { getAllProducts } from '@/services/menuService';
import { useBundleChoiceAvailabilityReview } from './useBundleChoiceAvailabilityReview';

jest.mock('@/services/menuService', () => ({ getAllProducts: jest.fn() }));

const requiredSection = (): MenuSection => ({
  id: 'drinks',
  name: 'Drinks',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [{ id: 'water', productId: 'water', additionalPrice: 0, displayOrder: 1, isDefault: false }],
});

const product: Product = {
  id: 'water',
  name: 'Water',
  description: '',
  basePrice: 0,
  isActive: true,
  isAvailable: true,
  type: 'mainItem',
  imageUrl: null,
  images: [],
  availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [OrderType.DineIn] },
};

const primaryCategory = { id: 'category', name: 'Category', availableOrderTypes: null };

const mockedGetAllProducts = jest.mocked(getAllProducts);

describe('useBundleChoiceAvailabilityReview', () => {
  beforeEach(() => {
    mockedGetAllProducts.mockReset();
    mockedGetAllProducts.mockResolvedValue([product]);
  });

  it('refreshes once for an unchanged review even when each render receives a new sections array', async () => {
    const { result } = renderHook(() =>
      useBundleChoiceAvailabilityReview({
        isOpen: true,
        isBundle: true,
        isActive: true,
        isChannelMaskValid: true,
        availableOrderTypes: null,
        primaryCategoryId: primaryCategory.id,
        categories: [primaryCategory],
        sections: [requiredSection()],
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(mockedGetAllProducts).toHaveBeenCalledTimes(1);
    expect(mockedGetAllProducts).toHaveBeenCalledWith(
      null,
      { includeMenus: true, includeComponents: true },
      expect.any(AbortSignal),
    );
  });

  it('fails closed when the fresh bounded read omits a referenced option', async () => {
    mockedGetAllProducts.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useBundleChoiceAvailabilityReview({
        isOpen: true,
        isBundle: true,
        isActive: true,
        isChannelMaskValid: true,
        availableOrderTypes: null,
        primaryCategoryId: primaryCategory.id,
        categories: [primaryCategory],
        sections: [requiredSection()],
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe('failed'));
    expect(mockedGetAllProducts).toHaveBeenCalledTimes(1);
  });

  it('fails closed without fetching when the parent channel mask is invalid', async () => {
    const { result } = renderHook(() =>
      useBundleChoiceAvailabilityReview({
        isOpen: true,
        isBundle: true,
        isActive: true,
        isChannelMaskValid: false,
        availableOrderTypes: 0,
        primaryCategoryId: primaryCategory.id,
        categories: [primaryCategory],
        sections: [requiredSection()],
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe('failed'));
    expect(mockedGetAllProducts).not.toHaveBeenCalled();
  });

  it('uses the selected primary category channels and warns only within those channels', async () => {
    const takeawayChild: Product = {
      ...product,
      availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [OrderType.Takeaway] },
    };
    mockedGetAllProducts.mockResolvedValue([takeawayChild]);

    const { result } = renderHook(() =>
      useBundleChoiceAvailabilityReview({
        isOpen: true,
        isBundle: true,
        isActive: true,
        isChannelMaskValid: true,
        availableOrderTypes: null,
        primaryCategoryId: primaryCategory.id,
        categories: [{ ...primaryCategory, availableOrderTypes: 6 }],
        sections: [requiredSection()],
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status !== 'ready') return;
    expect(result.current.state.assessment.sections[0].channels.map((channel) => channel.orderType)).toEqual([
      OrderType.Takeaway,
      OrderType.Delivery,
    ]);
    expect(result.current.state.assessment.warnings).toEqual([
      expect.objectContaining({ orderType: OrderType.Delivery, orderableCount: 0 }),
    ]);
  });

  it('fails visibly when the selected primary category is absent', async () => {
    mockedGetAllProducts.mockResolvedValue([product]);

    const { result } = renderHook(() =>
      useBundleChoiceAvailabilityReview({
        isOpen: true,
        isBundle: true,
        isActive: true,
        isChannelMaskValid: true,
        availableOrderTypes: null,
        primaryCategoryId: 'missing-category',
        categories: [],
        sections: [requiredSection()],
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe('failed'));
  });
});
