import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useCartPage } from './useCartPage';

const mockProceedToCheckout = jest.fn();
const mockPickType = jest.fn();
const mockEditOrderType = jest.fn();

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({
    state: {
      items: [{ basketItemId: 'basket-item', quantity: 1, itemTotal: 15 }],
      basket: { customerDiscount: 0, discount: 0 },
    },
    removeItem: jest.fn(),
    updateItem: jest.fn(),
    applyPromoCode: jest.fn(),
    removePromoCode: jest.fn(),
    getTotal: () => 15,
    getItemCount: () => 1,
  }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: { orderType: 'Takeaway' }, hasChosenOrderType: true }),
}));
jest.mock('@/hooks/checkout/useSmartCheckoutRouter', () => ({
  useSmartCheckoutRouter: () => ({ proceedToCheckout: mockProceedToCheckout, isResolving: false }),
}));
jest.mock('@/hooks/checkout/useCheckoutBlockerHint', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    useCheckoutBlockerHint: () => {
      const [blocker, setBlocker] = React.useState(null as string | null);
      return {
        blocker,
        message: blocker === 'details' ? 'We need a few more details before checkout' : '',
        setBlocker,
      };
    },
  };
});
jest.mock('@/hooks/order/useOrderTypeFollowUp', () => ({
  useOrderTypeFollowUp: () => ({ pickType: mockPickType, editOrderType: mockEditOrderType }),
}));
jest.mock('@/hooks/checkout/useTableGuestDineInAvailability', () => ({
  useTableGuestDineInAvailability: () => ({ blockerMessageKey: null }),
}));

describe('useCartPage checkout follow-up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProceedToCheckout.mockResolvedValue('details');
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps the details blocker retryable and logs no exception message when the follow-up rejects', async () => {
    const privateMessage = 'customer@example.test';
    mockPickType.mockRejectedValueOnce(new Error(privateMessage)).mockResolvedValueOnce(undefined);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCartPage());

    act(() => result.current.handleCheckout());
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));

    expect(mockPickType).toHaveBeenCalledWith(OrderType.Takeaway, 'cart_page', true);
    expect(result.current.blockerMessage).toBe('We need a few more details before checkout');
    expect(warning).toHaveBeenCalledWith(
      'Cart follow-up failed; the details step remains available for retry.',
      'Error',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain(privateMessage);

    act(() => result.current.handleCheckout());
    await waitFor(() => expect(mockPickType).toHaveBeenCalledTimes(2));
    expect(result.current.blockerMessage).toBe('We need a few more details before checkout');
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
