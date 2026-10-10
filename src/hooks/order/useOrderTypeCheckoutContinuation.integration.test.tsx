import { act, renderHook, waitFor } from '@testing-library/react';
import { CheckoutProvider, useCheckout } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { useOrderTypeCheckoutContinuation } from './useOrderTypeCheckoutContinuation';

const mockPush = jest.fn();
const mockProfile = jest.fn();
let mockBasketId = 'basket-one';
let mockHasItems = true;
let mockOrderType: OrderType = OrderType.Takeaway;

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ state: { items: mockHasItems ? [{}] : [], basket: { id: mockBasketId } } }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: { orderType: mockOrderType } }),
}));
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/checkout/useTableGuestDineInAvailability', () => ({
  useTableGuestDineInAvailability: () => ({ visitBound: false, active: false, dineInAvailable: true }),
}));
jest.mock('@/services/userService', () => ({ getCurrentUser: () => mockProfile() }));
jest.mock('@/services/addressService', () => ({ getMyAddresses: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn(), isLoggedInForAnalytics: () => false }));

const contact = { name: 'Guest', email: 'guest@test.local', phone: '+41791234567' };
function renderContinuation() {
  return renderHook(() => ({ flow: useOrderTypeCheckoutContinuation(), checkout: useCheckout() }), {
    wrapper: CheckoutProvider,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockBasketId = 'basket-one';
  mockHasItems = true;
  mockOrderType = OrderType.Takeaway;
});

it.each([OrderType.Takeaway, OrderType.Delivery, OrderType.DineIn])(
  'resumes explicit %s checkout once using committed contact/address state',
  async (type) => {
    mockOrderType = type;
    const { result } = renderContinuation();
    act(() => result.current.flow.request(type, 'cart_sheet', 'checkout'));
    act(() => {
      result.current.checkout.setCustomerInfo(contact);
      if (type === OrderType.Delivery)
        result.current.checkout.setDeliveryAddress({
          street: 'Rue 1',
          city: 'Geneva',
          postalCode: '1200',
          country: 'CH',
        });
      result.current.flow.confirm();
      result.current.flow.confirm();
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');
    expect(result.current.checkout.state.customerInfo).toEqual(contact);
    expect(mockProfile).not.toHaveBeenCalled();
  },
);

it('saving details after browsing a type leaves the guest in the basket', async () => {
  const { result } = renderContinuation();
  act(() => result.current.flow.request(OrderType.Takeaway, 'cart_sheet'));
  await act(async () => {
    result.current.checkout.setCustomerInfo(contact);
    result.current.flow.confirm();
  });
  expect(mockPush).not.toHaveBeenCalled();
});

it('cancelled details cannot resume on a late confirmation', async () => {
  const { result } = renderContinuation();
  act(() => result.current.flow.request(OrderType.Takeaway, 'cart_sheet', 'checkout'));
  act(() => result.current.flow.cancel());
  await act(async () => {
    result.current.checkout.setCustomerInfo(contact);
    result.current.flow.confirm();
  });
  expect(mockPush).not.toHaveBeenCalled();
});

it.each(['empty', 'replaced', 'channel'] as const)('drops checkout when the basket is %s', async (change) => {
  const { result, rerender } = renderContinuation();
  act(() => result.current.flow.request(OrderType.Takeaway, 'cart_sheet', 'checkout'));
  if (change === 'empty') mockHasItems = false;
  if (change === 'replaced') mockBasketId = 'basket-two';
  if (change === 'channel') mockOrderType = OrderType.Delivery;
  rerender();
  await act(async () => {
    result.current.checkout.setCustomerInfo(contact);
    result.current.flow.confirm();
  });
  expect(mockPush).not.toHaveBeenCalled();
});

it('a late profile result cannot navigate after cancellation', async () => {
  localStorage.setItem('auth_token', 'test-token');
  let finish!: (profile: unknown) => void;
  mockProfile.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { result } = renderContinuation();
  act(() => result.current.flow.request(OrderType.Takeaway, 'cart_sheet', 'checkout'));
  act(() => result.current.flow.confirm());
  await waitFor(() => expect(mockProfile).toHaveBeenCalledTimes(1));
  act(() => result.current.flow.cancel());
  await act(async () =>
    finish({ firstName: 'Guest', lastName: 'User', email: contact.email, phoneNumber: contact.phone }),
  );
  expect(mockPush).not.toHaveBeenCalled();
  expect(result.current.checkout.state.customerInfo).toBeNull();
});
