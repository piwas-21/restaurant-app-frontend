import { act, renderHook } from '@testing-library/react';
import { OrderType } from '@/types/order';
import type { CatalogItem, ItemAvailability } from '@/types/menu';
import { useCatalogSheet } from './useCatalogSheet';
import type { CatalogOfferFamily } from '@/types/menu/offerFamily';

/**
 * The catalog entry point onto the customization sheet, and specifically the §9.10 guard: a blocked
 * item must never reach the no-options QUICK-ADD path, which adds straight to the cart without
 * opening anything. The guard lives here rather than on each card, because "no current caller can
 * reach it" is exactly how the gap it closes came to exist.
 */
const mockOpenForProduct = jest.fn().mockResolvedValue(undefined);
const mockOpenForBundle = jest.fn();

jest.mock('./useItemCustomizationSheet', () => ({
  useItemCustomizationSheet: () => ({ kind: 'product', openForProduct: mockOpenForProduct }),
}));
jest.mock('./useBundleCustomizationSheet', () => ({
  useBundleCustomizationSheet: () => ({ kind: 'bundle', openForBundle: mockOpenForBundle }),
}));

// The drinks upsell reaches the cart and the order-type contexts, neither of which this
// provider-less suite mounts. It is exercised by its own tests; here it only has to exist.
jest.mock('./useDrinkUpsell', () => ({
  useDrinkUpsell: () => ({
    drinks: [],
    selected: {},
    subtotal: 0,
    add: jest.fn(),
    remove: jest.fn(),
    reset: jest.fn(),
    addSelected: jest.fn().mockResolvedValue(undefined),
    summary: () => [],
  }),
}));

const BLOCKED: ItemAvailability = {
  canOrder: false,
  reason: 'WrongOrderType',
  allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
};
const ORDERABLE: ItemAvailability = {
  canOrder: true,
  reason: 'Available',
  allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
};

const product = (availability?: ItemAvailability): CatalogItem => ({
  kind: 'product',
  id: 'p1',
  name: 'Dürüm',
  price: 12,
  isBundle: false,
  availability,
});

const family: CatalogOfferFamily = {
  id: 'family-p1',
  anchor: product(ORDERABLE),
  menuOffers: [{ productId: 'menu-p1', kind: 'bundle', name: 'Menu Dürüm', price: 15 }],
  categoryIds: ['cat-main'],
  startingPrice: 12,
};

/** The options `openForProduct` was called with. */
function openedWith() {
  return mockOpenForProduct.mock.calls[0]?.[1];
}

beforeEach(() => jest.clearAllMocks());

describe('useCatalogSheet — order-type verdict handover (§9.10)', () => {
  it('opens a purchase-mode choice for a family and carries its active filters', () => {
    const { result } = renderHook(() => useCatalogSheet());

    act(() => {
      result.current.openForCatalogItem(
        { ...product(ORDERABLE), id: family.id, offerFamily: family },
        { offerFamilyFilterIds: new Set(['claim:vegan']) },
      );
    });

    expect(result.current.offerFamily).toEqual(family);
    expect(result.current.offerFamilyFilterIds).toEqual(new Set(['claim:vegan']));
    expect(mockOpenForProduct).not.toHaveBeenCalled();
  });

  it('skips the mode step for a family with only its anchor offer', () => {
    const { result } = renderHook(() => useCatalogSheet());
    const anchorOnly = {
      ...product(ORDERABLE),
      id: 'family-single',
      offerFamily: { ...family, id: 'family-single', menuOffers: [] },
    };

    act(() => result.current.openForCatalogItem(anchorOnly));

    expect(result.current.offerFamily).toBeNull();
    expect(mockOpenForProduct).toHaveBeenCalledWith('family-single', expect.anything());
  });

  it('carries the card verdict into the sheet', () => {
    const { result } = renderHook(() => useCatalogSheet());

    result.current.openForCatalogItem(product(BLOCKED));

    expect(openedWith()).toMatchObject({ availability: BLOCKED });
  });

  it('FORCES the sheet for a blocked item, so the quick-add path cannot swallow it', () => {
    const { result } = renderHook(() => useCatalogSheet());

    // No `forceSheet` from the caller — this is the "Add to order" shape. A no-options product would
    // otherwise be added to the cart without anything rendering to say it cannot be ordered.
    result.current.openForCatalogItem(product(BLOCKED));

    expect(openedWith()).toMatchObject({ forceSheet: true });
  });

  it('leaves the quick-add path alone for an orderable item', () => {
    const { result } = renderHook(() => useCatalogSheet());

    result.current.openForCatalogItem(product(ORDERABLE));

    expect(openedWith()?.forceSheet).toBeFalsy();
  });

  it('leaves the quick-add path alone when there is no verdict at all', () => {
    const { result } = renderHook(() => useCatalogSheet());

    result.current.openForCatalogItem(product(undefined));

    expect(openedWith()?.forceSheet).toBeFalsy();
    expect(openedWith()?.availability).toBeUndefined();
  });

  it("still honours an explicit forceSheet — the guard widens the rule, it doesn't replace it", () => {
    const { result } = renderHook(() => useCatalogSheet());

    result.current.openForCatalogItem(product(ORDERABLE), { forceSheet: true });

    expect(openedWith()).toMatchObject({ forceSheet: true });
  });
});

describe('useCatalogSheet — openForProductId carries the guard for BY-ID entry points (G7)', () => {
  it('forces the sheet for a blocked item opened by id, not just by catalog item', () => {
    // The featured-special banner opens by ID, so while this rule lived in `openForCatalogItem` the
    // hero could hand over a blocked verdict and still quick-add straight to the cart.
    const { result } = renderHook(() => useCatalogSheet({}));

    result.current.openForProductId('p1', { availability: BLOCKED });

    expect(mockOpenForProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ forceSheet: true }));
  });

  it('leaves an orderable item on the quick-add path', () => {
    const { result } = renderHook(() => useCatalogSheet({}));

    result.current.openForProductId('p1', { availability: ORDERABLE });

    expect(mockOpenForProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ forceSheet: false }));
  });

  it('never DOWNGRADES an explicit forceSheet', () => {
    const { result } = renderHook(() => useCatalogSheet({}));

    result.current.openForProductId('p1', { availability: ORDERABLE, forceSheet: true });

    expect(mockOpenForProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ forceSheet: true }));
  });
});
