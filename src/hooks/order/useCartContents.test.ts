import { renderHook, act } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useCartContents } from './useCartContents';

const mockUpdateItem = jest.fn().mockResolvedValue(undefined);
const mockRemoveItem = jest.fn().mockResolvedValue(undefined);
const mockProceedToCheckout = jest.fn().mockResolvedValue(undefined);

let mockCartState: { items: Array<Record<string, unknown>>; isSyncing: boolean };
let mockOrderTypeState: { orderType: OrderType | undefined };
let mockHasChosenOrderType: boolean;
let mockIsResolving: boolean;

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ state: mockCartState, updateItem: mockUpdateItem, removeItem: mockRemoveItem }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: mockOrderTypeState, hasChosenOrderType: mockHasChosenOrderType }),
}));
jest.mock('@/hooks/checkout/useSmartCheckoutRouter', () => ({
  useSmartCheckoutRouter: () => ({ proceedToCheckout: mockProceedToCheckout, isResolving: mockIsResolving }),
}));

const item = (over: Record<string, unknown> = {}) => ({
  basketItemId: 'b1',
  productName: 'Shakshuka',
  quantity: 2,
  itemTotal: 24,
  ...over,
});

describe('useCartContents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCartState = { items: [], isSyncing: false };
    mockOrderTypeState = { orderType: undefined };
    mockHasChosenOrderType = false;
    mockIsResolving = false;
  });

  it('derives itemCount, subtotal and canCheckout from the cart', () => {
    mockCartState = {
      items: [item(), item({ basketItemId: 'b2', quantity: 1, itemTotal: 6 })],
      isSyncing: false,
    };
    mockHasChosenOrderType = true;
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));
    expect(result.current.itemCount).toBe(3);
    expect(result.current.subtotal).toBe(30);
    expect(result.current.canCheckout).toBe(true);
  });

  it('canCheckout is false with an empty cart even after an order type is chosen', () => {
    mockHasChosenOrderType = true;
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));
    expect(result.current.canCheckout).toBe(false);
  });

  it('handleQty updates the item; ignores a missing id or a below-1 quantity', () => {
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));
    act(() => result.current.handleQty('b1', 3));
    expect(mockUpdateItem).toHaveBeenCalledWith('b1', 3);
    act(() => result.current.handleQty('b1', 0));
    act(() => result.current.handleQty(undefined, 3));
    expect(mockUpdateItem).toHaveBeenCalledTimes(1);
  });

  it('handleRemove removes the item; ignores a missing id', () => {
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));
    act(() => result.current.handleRemove('b1'));
    expect(mockRemoveItem).toHaveBeenCalledWith('b1');
    act(() => result.current.handleRemove(undefined));
    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
  });

  it('handleCheckout proceeds only when allowed, firing onProceed first with the analytics source', () => {
    const onProceed = jest.fn();
    const args = { pickType: jest.fn(), onProceed, analyticsSource: 'mobile_sheet' };
    const { result, rerender } = renderHook((props) => useCartContents(props), { initialProps: args });

    act(() => result.current.handleCheckout());
    expect(mockProceedToCheckout).not.toHaveBeenCalled();
    expect(onProceed).not.toHaveBeenCalled();

    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockHasChosenOrderType = true;
    rerender(args);
    act(() => result.current.handleCheckout());
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(mockProceedToCheckout).toHaveBeenCalledWith(OrderType.DineIn, 'mobile_sheet');
  });

  it('handlePick forwards the analytics source (defaults to sidebar)', () => {
    const pickType = jest.fn();
    const { result } = renderHook(() => useCartContents({ pickType }));
    act(() => result.current.handlePick(OrderType.DineIn));
    expect(pickType).toHaveBeenCalledWith(OrderType.DineIn, 'sidebar');
  });
});
