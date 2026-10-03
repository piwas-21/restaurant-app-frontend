import { renderHook } from '@testing-library/react';
import {
  CheckoutTableGuestStateProvider,
  type CheckoutTableGuestState,
} from '@/contexts/CheckoutTableGuestStateContext';
import { OrderType } from '@/types/order';
import useTableGuestCheckout from './useTableGuestCheckout';

const mockPush = jest.fn();
const mockPushMenu = jest.fn();
let mockCartLastSyncedAt: number | null = 1;
let mockCartItems: readonly { readonly id: string }[] = [{ id: 'ready-item' }];
let mockCheckoutOrderType: string | null = OrderType.Takeaway;
let mockCheckoutCustomerInfo: { readonly name: string } | null = { name: 'Guest' };

jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({
    state: { orderType: mockCheckoutOrderType, customerInfo: mockCheckoutCustomerInfo },
    isHydrated: true,
  }),
}));
jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ state: { items: mockCartItems, lastSyncedAt: mockCartLastSyncedAt } }),
}));
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useTenantPublicNavigation', () => ({
  useTenantPublicNavigation: () => ({ pushMenu: mockPushMenu }),
}));

function renderCheckout(
  orderType: string,
  state?: CheckoutTableGuestState,
  hasPrerequisites = !state?.hasPendingRound,
) {
  mockCheckoutOrderType = orderType;
  mockCartLastSyncedAt = state?.hasPendingRound ? null : 1;
  mockCartItems = hasPrerequisites ? [{ id: 'ready-item' }] : [];
  mockCheckoutCustomerInfo = hasPrerequisites ? { name: 'Guest' } : null;
  const useCheckoutForTest = () => useTableGuestCheckout({ orderType, hasConfirmedOrder: false });
  if (!state) return renderHook(useCheckoutForTest);

  return renderHook(useCheckoutForTest, {
    wrapper: ({ children }) => (
      <CheckoutTableGuestStateProvider value={state}>{children}</CheckoutTableGuestStateProvider>
    ),
  });
}

describe('useTableGuestCheckout', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPushMenu.mockClear();
  });

  it('fails closed for dine-in while saved visit identity and pending round are unresolved', () => {
    const { result } = renderCheckout(OrderType.DineIn);

    expect(result.current.isTableVisitLoading).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isTableGuestRound).toBe(false);
    expect(result.current.isTableVisitBlocked).toBe(false);
  });

  it('does not strand takeaway while the lazy guest runtime has not mounted', () => {
    const { result } = renderCheckout(OrderType.Takeaway);

    expect(result.current.isTableVisitLoading).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isTableVisitBlocked).toBe(false);
  });

  it.each([OrderType.Takeaway, OrderType.Delivery])(
    'shows pending-operation recovery instead of loading or redirecting %s when the visit read is unavailable',
    (orderType) => {
      const { result } = renderCheckout(orderType, {
        phase: 'unavailable',
        hasPendingRound: true,
        hasAcknowledgement: false,
      });

      expect(result.current.hasPendingRound).toBe(true);
      expect(result.current.isTableGuestRound).toBe(false);
      expect(result.current.isTableVisitLoading).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockPushMenu).not.toHaveBeenCalled();
    },
  );

  it('does not redirect a pending operation while checkout/cart stores are not ready', () => {
    const { result } = renderCheckout(OrderType.Takeaway, {
      phase: 'unavailable',
      hasPendingRound: true,
      hasAcknowledgement: false,
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPushMenu).not.toHaveBeenCalled();
  });

  it('waits on non-DineIn checkout while saved guest state is still hydrating', () => {
    const { result } = renderCheckout(OrderType.Delivery, {
      phase: 'loading',
      hasPendingRound: true,
      hasAcknowledgement: false,
    });

    expect(result.current.isTableVisitLoading).toBe(true);
    expect(result.current.isLoading).toBe(true);
  });

  it('keeps existing dine-in checkout available after the public flag is authoritatively off', () => {
    const { result } = renderCheckout(OrderType.DineIn, {
      phase: 'notJoined',
      hasPendingRound: false,
      hasAcknowledgement: false,
    });

    expect(result.current.isTableGuestRound).toBe(false);
    expect(result.current.isTableVisitLoading).toBe(false);
    expect(result.current.isTableVisitBlocked).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps ordinary takeaway prerequisites intact when there is no pending operation', () => {
    const { result } = renderCheckout(
      OrderType.Takeaway,
      { phase: 'notJoined', hasPendingRound: false, hasAcknowledgement: false },
      false,
    );

    expect(result.current.isLoading).toBe(true);
    expect(mockPush).toHaveBeenCalledWith('/cart');
    expect(mockPushMenu).not.toHaveBeenCalled();
  });

  it('routes active guest visits to the account round and blocks ordinary dine-in placement', () => {
    const { result } = renderCheckout(OrderType.DineIn, {
      phase: 'active',
      hasPendingRound: true,
      hasAcknowledgement: false,
    });

    expect(result.current.isTableGuestRound).toBe(true);
    expect(result.current.isTableVisitLoading).toBe(false);
    expect(result.current.isTableVisitBlocked).toBe(false);
  });

  it('keeps ended and transient-unavailable visits out of ordinary dine-in checkout', () => {
    const { result } = renderCheckout(OrderType.DineIn, {
      phase: 'unavailable',
      hasPendingRound: true,
      hasAcknowledgement: false,
    });

    expect(result.current.isTableGuestRound).toBe(false);
    expect(result.current.isTableVisitBlocked).toBe(true);
    expect(result.current.tableGuestVisitPhase).toBe('unavailable');
  });
});
