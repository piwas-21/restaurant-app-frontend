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
let mockTableDineIn: { visitBound: boolean; active: boolean; dineInAvailable: boolean };

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
jest.mock('@/hooks/checkout/useTableGuestDineInAvailability', () => ({
  useTableGuestDineInAvailability: () => mockTableDineIn,
}));
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  isLoggedInForAnalytics: () => false,
}));

function renderRouter(state: CheckoutTableGuestState) {
  if (state.phase === 'active') {
    mockTableDineIn = { visitBound: true, active: true, dineInAvailable: true };
  } else if (state.phase !== 'notJoined' && state.phase !== 'loading') {
    mockTableDineIn = { visitBound: true, active: false, dineInAvailable: false };
  } else if (state.phase === 'loading' && state.hasPendingRound) {
    mockTableDineIn = { visitBound: true, active: false, dineInAvailable: false };
  } else {
    mockTableDineIn = { visitBound: false, active: false, dineInAvailable: false };
  }
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
    mockTableDineIn = { visitBound: false, active: false, dineInAvailable: false };
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
    'an active visit routes stale %s state to the guarded table-round review',
    async (orderType) => {
      expect(await proceed({ ...notJoined, phase: 'active' }, orderType)).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/checkout/review');
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    },
  );

  it('retains the ordinary checkout fast path when contact information is complete', async () => {
    mockCustomerInfo = { name: 'Guest', email: 'Guest', phone: '' };
    expect(await proceed(notJoined, OrderType.DineIn)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it('routes an admitted guest to the table-round review even before the order type is restored', async () => {
    expect(await proceed({ ...notJoined, phase: 'active' }, null)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');
  });

  it('blocks an active visit when the public Dine-In availability read says closed', async () => {
    const { result } = renderRouter({ ...notJoined, phase: 'active' });
    mockTableDineIn.dineInAvailable = false;

    await act(async () => {
      expect(await result.current.proceedToCheckout(OrderType.DineIn)).toBe('table-guest-unavailable');
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it('routes a pending active round to recovery even while Dine-In is closed', async () => {
    const { result } = renderRouter({ ...notJoined, phase: 'active', hasPendingRound: true });
    mockTableDineIn.dineInAvailable = false;

    await act(async () => {
      expect(await result.current.proceedToCheckout(OrderType.DineIn)).toBeNull();
    });

    expect(mockPush).toHaveBeenCalledWith('/checkout/review');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockGetMyAddresses).not.toHaveBeenCalled();
  });
});
