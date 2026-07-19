import { renderHook, act, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useOrderTypeFollowUp } from './useOrderTypeFollowUp';

const mockSetOrderType = jest.fn();
const mockSetTable = jest.fn();
// Complete customer info, so needsTakeawayInfoModal() returns false by default.
const mockCustomerInfo = { name: 'Guest', email: 'g@test.local', phone: '+41791234567' };

jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ hasChosenOrderType: false, setOrderType: mockSetOrderType, setTable: mockSetTable }),
}));
jest.mock('@/contexts/TableContext', () => ({
  useTableContext: () => ({ hasTableContext: false, tableContext: { tableNumber: '' } }),
}));
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({ state: { customerInfo: mockCustomerInfo } }),
}));
jest.mock('@/services/userService', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ isLoggedInForAnalytics: () => false, trackEvent: jest.fn() }));

describe('useOrderTypeFollowUp', () => {
  it('forceModal opens the Takeaway modal even when the profile is already complete (Edit path)', async () => {
    const { result } = renderHook(() => useOrderTypeFollowUp());
    act(() => {
      void result.current.pickType(OrderType.Takeaway, 'checkout_review', true);
    });
    await waitFor(() => expect(result.current.followUp).toBe('takeaway'));
  });

  it('without forceModal, a Takeaway pick with complete info opens no modal', async () => {
    const { result } = renderHook(() => useOrderTypeFollowUp());
    // Open a modal first so the null assertion is meaningful (a real table→null transition).
    act(() => {
      void result.current.pickType(OrderType.DineIn);
    });
    await waitFor(() => expect(result.current.followUp).toBe('table'));

    act(() => {
      void result.current.pickType(OrderType.Takeaway);
    });
    await waitFor(() => expect(result.current.followUp).toBeNull());
  });
});
