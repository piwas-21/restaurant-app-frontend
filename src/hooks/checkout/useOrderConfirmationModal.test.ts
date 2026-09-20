import { act, renderHook, waitFor } from '@testing-library/react';
import { PaymentMethod } from '@/types/order';
import { useOrderConfirmationModal } from './useOrderConfirmationModal';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const confirmed = {
  id: 'order-id',
  orderNumber: 'ORD-42',
  customerEmail: '',
  paymentMethod: PaymentMethod.Cash,
};

beforeEach(() => {
  mockPush.mockClear();
  localStorage.clear();
});

describe('useOrderConfirmationModal', () => {
  it('routes a guest with the read-only token to the live confirmation page', async () => {
    const { result } = renderHook(() => useOrderConfirmationModal());
    act(() => {
      result.current.setConfirmedOrder({
        ...confirmed,
        guestStatusToken: 'token+/=?',
        confirmationFlow: 'acknowledge',
      });
    });
    await waitFor(() => expect(result.current.showConfirmationModal).toBe(true));

    act(() => result.current.handleCloseConfirmationModal());

    expect(mockPush).toHaveBeenCalledWith(
      '/checkout/confirmation?orderId=order-id&orderNumber=ORD-42#t=token%2B%2F%3D%3F',
    );
  });

  it('keeps the existing menu behavior for a direct-flow guest even when a token exists', async () => {
    const { result } = renderHook(() => useOrderConfirmationModal());
    act(() =>
      result.current.setConfirmedOrder({ ...confirmed, guestStatusToken: 'read-token', confirmationFlow: 'direct' }),
    );
    await waitFor(() => expect(result.current.showConfirmationModal).toBe(true));

    act(() => result.current.handleCloseConfirmationModal());

    expect(mockPush).toHaveBeenCalledWith('/menu');
  });

  it('keeps the existing confirmation route for a signed-in customer without a token', async () => {
    localStorage.setItem('auth_token', 'auth');
    const { result } = renderHook(() => useOrderConfirmationModal());
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    act(() => result.current.setConfirmedOrder(confirmed));

    act(() => result.current.handleCloseConfirmationModal());

    expect(mockPush).toHaveBeenCalledWith('/checkout/confirmation?orderId=order-id&orderNumber=ORD-42');
  });
});
