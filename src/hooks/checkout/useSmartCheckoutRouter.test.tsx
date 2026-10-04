import { act, renderHook } from '@testing-library/react';
import {
  CheckoutTableGuestStateProvider,
  type CheckoutTableGuestState,
} from '@/contexts/CheckoutTableGuestStateContext';
import type { CustomerInfo, DeliveryAddress } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { useSmartCheckoutRouter } from './useSmartCheckoutRouter';

const mockPush = jest.fn();
const mockTrackEvent = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetMyAddresses = jest.fn();
const mockSetCustomerInfo = jest.fn();
const mockSetDeliveryAddress = jest.fn();
let mockCustomerInfo: CustomerInfo | null;
let mockDeliveryAddress: DeliveryAddress | null;

jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: mockPush }) }));
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({
    state: { customerInfo: mockCustomerInfo, deliveryAddress: mockDeliveryAddress },
    setCustomerInfo: mockSetCustomerInfo,
    setDeliveryAddress: mockSetDeliveryAddress,
  }),
}));
jest.mock('@/services/userService', () => ({ getCurrentUser: () => mockGetCurrentUser() }));
jest.mock('@/services/addressService', () => ({ getMyAddresses: () => mockGetMyAddresses() }));
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  isLoggedInForAnalytics: () => false,
}));

function renderRouter(state: CheckoutTableGuestState) {
  return renderHook(() => useSmartCheckoutRouter(), {
    wrapper: ({ children }) => (
      <CheckoutTableGuestStateProvider value={state}>{children}</CheckoutTableGuestStateProvider>
    ),
  });
}

async function proceed(state: CheckoutTableGuestState, orderType: OrderType | null) {
  const { result } = renderRouter(state);
  let blocker: Awaited<ReturnType<typeof result.current.proceedToCheckout>>;
  await act(async () => {
    blocker = await result.current.proceedToCheckout(orderType, 'mobile_sheet');
  });
  return blocker!;
}

const notJoined: CheckoutTableGuestState = { phase: 'notJoined', hasPendingRound: false, hasAcknowledgement: false };

describe('useSmartCheckoutRouter visit-aware entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockCustomerInfo = null;
    mockDeliveryAddress = null;
  });

  it.each(['active', 'ended', 'unavailable', 'storageUnavailable'] as const)(
    'routes dine-in %s visit state to the guarded review without collecting contact details',
    async (phase) => {
      const blocker = await proceed({ ...notJoined, phase }, OrderType.DineIn);

      expect(blocker).toBeNull();
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/checkout/review');
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
      expect(mockGetMyAddresses).not.toHaveBeenCalled();
      expect(mockSetCustomerInfo).not.toHaveBeenCalled();
      expect(mockTrackEvent).toHaveBeenCalledWith('checkout_opened', {
        orderType: OrderType.DineIn,
        source: 'mobile_sheet',
        loggedIn: false,
      });
    },
  );

  it('routes bridged visit loading to recovery while storage cannot prove a round is absent', async () => {
    expect(await proceed({ ...notJoined, phase: 'loading', hasPendingRound: true }, OrderType.DineIn)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');
  });

  it('requires ordinary dine-in details when the cart has no visit provider', async () => {
    const { result } = renderHook(() => useSmartCheckoutRouter());
    await act(async () => {
      expect(await result.current.proceedToCheckout(OrderType.DineIn, 'cart_page')).toBe('details');
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('retains ordinary contact routing when the cart has no visit provider', async () => {
    mockCustomerInfo = { name: 'Guest', email: 'Guest', phone: '' };
    const { result } = renderHook(() => useSmartCheckoutRouter());
    await act(async () => {
      expect(await result.current.proceedToCheckout(OrderType.DineIn, 'cart_page')).toBeNull();
    });
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it.each([OrderType.Takeaway, OrderType.Delivery])(
    'preserves pending round recovery after the selected type changes to %s',
    async (orderType) => {
      expect(await proceed({ ...notJoined, phase: 'unavailable', hasPendingRound: true }, orderType)).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/checkout/review');
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
      expect(mockGetMyAddresses).not.toHaveBeenCalled();
    },
  );

  it.each([OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery])(
    'still requires ordinary contact details for unjoined %s checkout',
    async (orderType) => {
      expect(await proceed(notJoined, orderType)).toBe('details');
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockTrackEvent).not.toHaveBeenCalled();
    },
  );

  it.each([OrderType.Takeaway, OrderType.Delivery])(
    'an active visit does not bypass the ordinary %s details requirement without a pending round',
    async (orderType) => {
      expect(await proceed({ ...notJoined, phase: 'active' }, orderType)).toBe('details');
      expect(mockPush).not.toHaveBeenCalled();
    },
  );

  it('retains the ordinary checkout fast path when contact information is complete', async () => {
    mockCustomerInfo = { name: 'Guest', email: 'Guest', phone: '' };
    expect(await proceed(notJoined, OrderType.DineIn)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it('still requires an order type before routing an admitted guest', async () => {
    expect(await proceed({ ...notJoined, phase: 'active' }, null)).toBe('order-type');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
