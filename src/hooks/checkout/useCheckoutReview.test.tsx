import { act, renderHook } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import {
  CheckoutTableGuestStateProvider,
  type CheckoutTableGuestState,
} from '@/contexts/CheckoutTableGuestStateContext';
import { OrderType, PaymentMethod } from '@/types/order';
import { useCheckoutReview } from './useCheckoutReview';

let mockOrderType: string = OrderType.Takeaway;
let mockPaymentMethod: string = PaymentMethod.Cash;
const mockCreateOrderFromBasket = jest.fn();
const mockPayOnline = jest.fn();
const mockCreateTableGuestRound = jest.fn();
const mockBuildOrderCommand = jest.fn();

jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({
    state: {
      orderType: mockOrderType,
      customerInfo: { name: 'Guest', email: '', phone: '' },
      tableNumber: '',
      deliveryAddress: null,
      specialInstructions: '',
      tipAmount: 0,
    },
    clearCheckout: jest.fn(),
    setTipAmount: jest.fn(),
  }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: () => ({ clearOrderType: jest.fn() }) }));
jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({
    state: { basket: { subTotal: 12, total: 12 }, items: [] },
    clearCart: jest.fn(),
  }),
}));
jest.mock('@/hooks/useSession', () => ({ useSession: jest.fn() }));
jest.mock('@/hooks/order/useOrderTypeFollowUp', () => ({
  useOrderTypeFollowUp: () => ({ editOrderType: jest.fn(), editContact: jest.fn() }),
}));
jest.mock('@/services/orderService', () => ({
  createOrderFromBasket: (...args: unknown[]) => mockCreateOrderFromBasket(...args),
}));
jest.mock('@/services/emailService', () => ({ sendOrderConfirmationEmails: jest.fn() }));
jest.mock('@/utils/orderErrorHandler', () => ({ getTranslatedOrderError: jest.fn(() => 'error') }));
jest.mock('@/utils/currency', () => ({ formatPlainCurrency: jest.fn(() => ''), formatCurrency: jest.fn(() => '') }));
jest.mock('@/lib/analytics', () => ({ isLoggedInForAnalytics: () => false, trackEvent: jest.fn() }));
jest.mock('@/lib/checkout/buildOrderCommand', () => ({
  buildOrderCommand: (...args: unknown[]) => mockBuildOrderCommand(...args),
}));
jest.mock('./useCheckoutTax', () => ({ useCheckoutTax: () => ({ taxConfig: null, taxAmount: 0 }) }));
jest.mock('./useOrderConfirmationModal', () => ({
  useOrderConfirmationModal: () => ({
    confirmedOrder: null,
    setConfirmedOrder: jest.fn(),
    showConfirmationModal: false,
    isLoggedIn: false,
    handleCloseConfirmationModal: jest.fn(),
    handleTrackOrder: jest.fn(),
  }),
}));
jest.mock('./useOnlinePaymentAvailability', () => ({ useOnlinePaymentAvailability: () => false }));
jest.mock('./useOnlineCheckout', () => ({
  useOnlineCheckout: () => ({ payOnline: (...args: unknown[]) => mockPayOnline(...args) }),
}));
jest.mock('@/hooks/orderTypes/useConfirmationFlowConfig', () => ({
  flowLookup: () => () => null,
  useConfirmationFlowConfig: () => ({ flowByType: {} }),
}));
jest.mock('@/services/orderTypeConfigurationService', () => ({ resolvePublicConfirmationFlow: jest.fn() }));
jest.mock('./useCheckoutReviewPageView', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./useEffectiveCheckoutPaymentMethod', () => ({
  __esModule: true,
  default: () => ({
    selectedPaymentMethod: mockPaymentMethod,
    effectivePaymentMethod: mockPaymentMethod,
    setSelectedPaymentMethod: jest.fn(),
  }),
}));
jest.mock('./useCheckoutPrereqGuard', () => ({
  useCheckoutPrereqGuard: () => ({ storesReady: true, isMissingPrereqs: false }),
}));
jest.mock('@/services/tableGuestVisitService', () => ({
  tableGuestVisitService: { createTableGuestRound: (...args: unknown[]) => mockCreateTableGuestRound(...args) },
}));

function renderReview(
  orderType: string,
  paymentMethod: string,
  guestState: CheckoutTableGuestState = { phase: 'active', hasPendingRound: true, hasAcknowledgement: false },
) {
  mockOrderType = orderType;
  mockPaymentMethod = paymentMethod;
  return renderHook(() => useCheckoutReview(), {
    wrapper: ({ children }) => (
      <I18nextProvider i18n={i18n}>
        <CheckoutTableGuestStateProvider value={guestState}>{children}</CheckoutTableGuestStateProvider>
      </I18nextProvider>
    ),
  });
}

describe('useCheckoutReview with an unresolved guest round', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [OrderType.DineIn, PaymentMethod.Cash, 'active'],
    [OrderType.Takeaway, PaymentMethod.Cash, 'active'],
    [OrderType.Delivery, PaymentMethod.OnlinePayment, 'active'],
    [OrderType.Delivery, PaymentMethod.Cash, 'loading'],
  ] as const)(
    'does not create a legacy %s order while guest-round state is %s',
    async (orderType, paymentMethod, phase) => {
      const guestState: CheckoutTableGuestState = { phase, hasPendingRound: true, hasAcknowledgement: false };
      const { result } = renderReview(orderType, paymentMethod, guestState);

      await act(async () => result.current.handlePlaceOrder());

      expect(mockCreateOrderFromBasket).not.toHaveBeenCalled();
      expect(mockPayOnline).not.toHaveBeenCalled();
      expect(mockBuildOrderCommand).not.toHaveBeenCalled();
      expect(mockCreateTableGuestRound).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.hasPendingRound).toBe(true);
    },
  );

  it('keeps an unrelated takeaway order available after guest storage proves no visit is joined', async () => {
    mockCreateOrderFromBasket.mockResolvedValue({
      id: 'legacy-order',
      orderNumber: 17,
      guestStatusToken: null,
      type: OrderType.Takeaway,
    });
    const { result } = renderReview(OrderType.Takeaway, PaymentMethod.Cash, {
      phase: 'notJoined',
      hasPendingRound: false,
      hasAcknowledgement: false,
    });

    await act(async () => result.current.handlePlaceOrder());

    expect(mockCreateOrderFromBasket).toHaveBeenCalledTimes(1);
    expect(mockCreateTableGuestRound).not.toHaveBeenCalled();
  });
});
