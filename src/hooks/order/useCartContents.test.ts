import { renderHook, act, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useCartContents } from './useCartContents';

const mockUpdateItem = jest.fn().mockResolvedValue(undefined);
const mockRemoveItem = jest.fn().mockResolvedValue(undefined);
const mockProceedToCheckout = jest.fn().mockResolvedValue(null);
const mockClearError = jest.fn();
const mockSetOrderType = jest.fn();
const mockSetTable = jest.fn();
const mockSelectActiveVisitDineIn = jest.fn(() => {
  if (!mockTableGuestState.active || !mockTableGuestState.dineInAvailable) return false;
  mockSetOrderType(OrderType.DineIn);
  return true;
});

let mockCartState: {
  items: Array<Record<string, unknown>>;
  isSyncing: boolean;
  error?: string | null;
  basket?: { items: unknown[]; orderType?: OrderType | null } | null;
};
let mockOrderTypeState: { orderType: OrderType | undefined };
let mockHasChosenOrderType: boolean;
let mockIsResolving: boolean;
let mockChannelRecovery: { isPending: boolean; isVisible: boolean; isRetrying: boolean; retry: jest.Mock };
let mockTableGuestState: {
  visitBound: boolean;
  active: boolean;
  dineInAvailable: boolean;
  blockerMessageKey: string | null;
};

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({
    state: mockCartState,
    updateItem: mockUpdateItem,
    removeItem: mockRemoveItem,
    clearError: mockClearError,
    syncBasket: jest.fn().mockResolvedValue(true),
  }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({
    state: mockOrderTypeState,
    hasChosenOrderType: mockHasChosenOrderType,
    setOrderType: mockSetOrderType,
    setTable: mockSetTable,
  }),
}));
jest.mock('@/hooks/checkout/useSmartCheckoutRouter', () => ({
  useSmartCheckoutRouter: () => ({ proceedToCheckout: mockProceedToCheckout, isResolving: mockIsResolving }),
}));
jest.mock('@/hooks/order/useBasketChannelRecovery', () => ({
  useBasketChannelRecovery: () => mockChannelRecovery,
}));
jest.mock('@/contexts/TableContext', () => ({
  useTableContext: () => ({ tableContext: { tableId: 'table-11', tableNumber: '11a' } }),
}));
jest.mock('@/hooks/order/useTableGuestOrderTypeRecovery', () => ({
  useTableGuestOrderTypeRecovery: () => ({
    tableGuest: mockTableGuestState,
    selectActiveVisitDineIn: mockSelectActiveVisitDineIn,
  }),
}));
// Pulled in by useCheckoutBlockerHint, which derives the "why can't I check out?" copy.
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({ state: { customerInfo: null, deliveryAddress: null } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
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
    mockCartState = { items: [], isSyncing: false, error: null };
    mockOrderTypeState = { orderType: undefined };
    mockHasChosenOrderType = false;
    mockIsResolving = false;
    mockChannelRecovery = {
      isPending: false,
      isVisible: false,
      isRetrying: false,
      retry: jest.fn(),
    };
    mockTableGuestState = {
      visitBound: false,
      active: false,
      dineInAvailable: false,
      blockerMessageKey: null,
    };
  });

  // #415. `state.error` is one global slot written by six places and cleared by one reducer arm,
  // and `CartProvider` sits in the root layout so it never remounts on navigation. Once these cart
  // surfaces started rendering it, a failure from a different operation on a different route — a
  // refused promo code, say — would sit in the `/menu` sidebar until the next successful cart write.
  it('clears a stale error when the surface mounts, exactly once', () => {
    renderHook(() => useCartContents({ pickType: jest.fn() }));

    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it('exposes the cart error for the surface to render', () => {
    mockCartState = { items: [], isSyncing: false, error: 'Your shopping cart is empty or expired' };

    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));

    expect(result.current.error).toBe('Your shopping cart is empty or expired');
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

  it('closes the sheet only after the router succeeds and forwards the analytics source', async () => {
    const sequence: string[] = [];
    const onProceed = jest.fn(() => sequence.push('close'));
    const args = { pickType: jest.fn(), onProceed, analyticsSource: 'mobile_sheet' };
    const { result, rerender } = renderHook((props) => useCartContents(props), { initialProps: args });

    await act(async () => result.current.handleCheckout());
    expect(mockProceedToCheckout).not.toHaveBeenCalled();
    expect(onProceed).not.toHaveBeenCalled();

    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockHasChosenOrderType = true;
    rerender(args);
    mockProceedToCheckout.mockImplementationOnce(async () => {
      sequence.push('router');
      return null;
    });
    await act(async () => result.current.handleCheckout());
    expect(mockProceedToCheckout).toHaveBeenCalledWith(OrderType.DineIn, 'mobile_sheet');
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(sequence).toEqual(['router', 'close']);
  });

  it('holds checkout while a basket order-type pick is unresolved', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockHasChosenOrderType = true;
    let finishPick!: () => void;
    const pickType = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPick = resolve;
        }),
    );
    const { result } = renderHook(() => useCartContents({ pickType, analyticsSource: 'cart_sheet' }));

    act(() => result.current.handlePick(OrderType.Takeaway));
    expect(result.current.isOrderTypeSelectionPending).toBe(true);

    await act(async () => result.current.handleCheckout());
    expect(mockProceedToCheckout).not.toHaveBeenCalled();

    await act(async () => finishPick());
    expect(result.current.isOrderTypeSelectionPending).toBe(false);
  });

  it('holds checkout while the background basket-channel reconciliation is pending', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.Takeaway };
    mockHasChosenOrderType = true;
    mockChannelRecovery = { ...mockChannelRecovery, isPending: true };
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));

    expect(result.current.isOrderTypeSelectionPending).toBe(true);
    await act(async () => result.current.handleCheckout());
    expect(mockProceedToCheckout).not.toHaveBeenCalled();
  });

  it('locks order-type changes while logged-in profile resolution is pending', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockHasChosenOrderType = true;
    let finishProfileLookup!: (blocker: null) => void;
    mockProceedToCheckout.mockImplementationOnce(() => new Promise<null>((resolve) => (finishProfileLookup = resolve)));
    const pickType = jest.fn();
    const onProceed = jest.fn();
    const { result } = renderHook(() => useCartContents({ pickType, onProceed }));

    act(() => result.current.handleCheckout());
    expect(result.current.isCheckoutPending).toBe(true);

    act(() => result.current.handlePick(OrderType.Takeaway));
    expect(pickType).not.toHaveBeenCalled();

    await act(async () => finishProfileLookup(null));
    expect(mockProceedToCheckout).toHaveBeenCalledWith(OrderType.DineIn, 'sidebar');
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it('starts only one route attempt for repeated Proceed taps', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockHasChosenOrderType = true;
    let finishRoute!: (blocker: null) => void;
    const onProceed = jest.fn();
    mockProceedToCheckout.mockImplementationOnce(
      () =>
        new Promise<null>((resolve) => {
          finishRoute = resolve;
        }),
    );
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn(), onProceed }));

    act(() => {
      result.current.handleCheckout();
      result.current.handleCheckout();
    });
    expect(mockProceedToCheckout).toHaveBeenCalledTimes(1);
    expect(result.current.isCheckoutPending).toBe(true);

    await act(async () => finishRoute(null));
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(result.current.isCheckoutPending).toBe(true);
    act(() => result.current.handleCheckout());
    expect(mockProceedToCheckout).toHaveBeenCalledTimes(1);
  });

  it('explains a cart with no order type instead of silently doing nothing', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));

    // Up front, before any click — the customer shouldn't have to click to find out.
    expect(result.current.blockerMessage).toBe('Choose how you want to order to continue');

    await act(async () => result.current.handleCheckout());
    expect(mockProceedToCheckout).not.toHaveBeenCalled();
    expect(result.current.blockerMessage).toBe('Choose how you want to order to continue');
  });

  /**
   * The sentence alone was not enough: it sits under a full-strength CTA and the click still
   * appeared to do nothing. `orderTypeAttempts` is what sends the guest TO the toggle — zero until
   * a click is actually refused (so opening the basket does not drag them anywhere), and RISING on
   * each further refusal, because the toggle's effect cannot fire twice on an unchanging value.
   */
  it('counts refused Proceed clicks so the surface can send the guest to the toggle', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));

    expect(result.current.blockerMessage).toBe('Choose how you want to order to continue');
    expect(result.current.orderTypeAttempts).toBe(0);

    await act(async () => result.current.handleCheckout());
    expect(result.current.orderTypeAttempts).toBe(1);

    await act(async () => result.current.handleCheckout());
    expect(result.current.orderTypeAttempts).toBe(2);
  });

  it('does not send the guest to the toggle when the blocker is missing DETAILS, not a type', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.Takeaway };
    mockHasChosenOrderType = true;
    mockProceedToCheckout.mockResolvedValueOnce('details');

    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));
    await act(async () => result.current.handleCheckout());

    expect(result.current.blockerMessage).toBe('We need a few more details before checkout');
    expect(result.current.orderTypeAttempts).toBe(0);
  });

  it('an empty cart is a true no-op — no refusal is recorded', async () => {
    mockCartState = { items: [], isSyncing: false };
    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));
    await act(async () => result.current.handleCheckout());
    expect(result.current.orderTypeAttempts).toBe(0);
  });

  it('reopens the type modal when the router reports missing details', async () => {
    const pickType = jest.fn();
    const onProceed = jest.fn();
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.Takeaway };
    mockHasChosenOrderType = true;
    mockProceedToCheckout.mockResolvedValueOnce('details');

    const { result } = renderHook(() => useCartContents({ pickType, onProceed }));
    await act(async () => result.current.handleCheckout());

    // forceModal=true — Takeaway would otherwise decide it has nothing to ask.
    expect(pickType).toHaveBeenCalledWith(OrderType.Takeaway, 'sidebar', true);
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(result.current.blockerMessage).toBe('We need a few more details before checkout');
  });

  it('holds checkout pending until the missing-details order type follow-up settles', async () => {
    let finishPick!: () => void;
    const pickType = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPick = resolve;
        }),
    );
    const onProceed = jest.fn();
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.Takeaway };
    mockHasChosenOrderType = true;
    mockProceedToCheckout.mockResolvedValueOnce('details');

    const { result } = renderHook(() => useCartContents({ pickType, onProceed }));
    act(() => result.current.handleCheckout());

    await waitFor(() => expect(pickType).toHaveBeenCalledWith(OrderType.Takeaway, 'sidebar', true));
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(result.current.blockerMessage).toBe('We need a few more details before checkout');
    expect(result.current.isCheckoutPending).toBe(true);

    await act(async () => finishPick());
    expect(result.current.isCheckoutPending).toBe(false);
  });

  it('keeps the cart surface open when the active table visit is unavailable', async () => {
    const onProceed = jest.fn();
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockHasChosenOrderType = true;
    mockTableGuestState = {
      visitBound: true,
      active: true,
      dineInAvailable: false,
      blockerMessageKey: 'table_guest_dine_in_unavailable',
    };
    mockProceedToCheckout.mockResolvedValueOnce('table-guest-unavailable');

    const { result } = renderHook(() => useCartContents({ pickType: jest.fn(), onProceed }));
    await act(async () => result.current.handleCheckout());

    expect(onProceed).not.toHaveBeenCalled();
    expect(result.current.blockerMessage).toBe('table_guest_dine_in_unavailable');
  });

  it.each([
    ['ended', 'table_guest_ended_detail'],
    ['storageUnavailable', 'table_guest_storage_help'],
    ['unavailable', 'table_guest_unavailable_detail'],
  ])('uses phase-appropriate copy for a %s visit', (phase, messageKey) => {
    mockCartState = { items: [item()], isSyncing: false };
    mockTableGuestState = {
      visitBound: true,
      active: false,
      dineInAvailable: false,
      blockerMessageKey: messageKey,
    };

    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));

    expect(result.current.blockerMessage).toBe(messageKey);
  });

  it('says nothing when the checkout routes successfully', async () => {
    mockCartState = { items: [item()], isSyncing: false };
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockHasChosenOrderType = true;
    mockProceedToCheckout.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useCartContents({ pickType: jest.fn() }));
    await act(async () => result.current.handleCheckout());
    expect(result.current.blockerMessage).toBe('');
  });

  it('handlePick forwards the analytics source (defaults to sidebar)', () => {
    const pickType = jest.fn();
    const { result } = renderHook(() => useCartContents({ pickType }));
    act(() => result.current.handlePick(OrderType.DineIn));
    expect(pickType).toHaveBeenCalledWith(OrderType.DineIn, 'sidebar');
  });

  it('uses the active visit picker instead of the outer page callback', async () => {
    mockTableGuestState = {
      visitBound: true,
      active: true,
      dineInAvailable: true,
      blockerMessageKey: null,
    };
    const pickType = jest.fn();
    const { result } = renderHook(() => useCartContents({ pickType, analyticsSource: 'cart_sheet' }));

    await act(async () => result.current.handlePick(OrderType.DineIn));

    expect(mockSelectActiveVisitDineIn).toHaveBeenCalledWith('cart_sheet');
    expect(mockSetOrderType).toHaveBeenCalledWith(OrderType.DineIn);
    expect(pickType).not.toHaveBeenCalled();
  });

  it.each([
    ['Takeaway', OrderType.Takeaway, true, true],
    ['Delivery', OrderType.Delivery, true, true],
    ['unavailable DineIn', OrderType.DineIn, true, false],
    ['ended DineIn', OrderType.DineIn, false, false],
  ])('keeps a bound visit on its own picker for %s', async (_label, type, active, dineInAvailable) => {
    mockTableGuestState = {
      visitBound: true,
      active,
      dineInAvailable,
      blockerMessageKey: null,
    };
    const pickType = jest.fn();
    const { result } = renderHook(() => useCartContents({ pickType }));

    await act(async () => result.current.handlePick(type as OrderType));

    expect(pickType).not.toHaveBeenCalled();
    if (type === OrderType.DineIn && active && dineInAvailable) {
      expect(mockSelectActiveVisitDineIn).toHaveBeenCalledWith('sidebar');
    } else {
      expect(mockSetOrderType).not.toHaveBeenCalled();
    }
  });
});
