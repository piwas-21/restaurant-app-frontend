import { render, screen } from '@testing-library/react';
import CheckoutReviewLayout, { type CheckoutReviewStyles } from './CheckoutReviewLayout';

const mockReview = {
  t: (key: string) => key,
  checkoutState: {},
  cartState: {},
  orderTypeFollowUp: {},
  selectedPaymentMethod: 'Cash',
  setSelectedPaymentMethod: jest.fn(),
  onlinePaymentAvailable: false,
  redeemedPoints: 0,
  handlePointsRedemption: jest.fn(),
  taxConfig: null,
  taxAmount: 0,
  pointsDiscount: 0,
  setTipAmount: jest.fn(),
  isSubmitting: false,
  submitError: '',
  showConfirmationModal: false,
  confirmedOrder: null,
  isLoggedIn: false,
  handleCloseConfirmationModal: jest.fn(),
  handleTrackOrder: jest.fn(),
  handlePlaceOrder: jest.fn(),
  isTableGuestRound: false,
  hasPendingRound: true,
  isTableVisitBlocked: false,
  tableGuestVisitPhase: 'unavailable',
  formatPrice: jest.fn(),
  formatTotal: jest.fn(),
  isLoading: false,
};

jest.mock('@/hooks/checkout/useCheckoutReview', () => ({ useCheckoutReview: () => mockReview }));
jest.mock('next/dynamic', () => {
  const React: typeof import('react') = jest.requireActual('react');
  return {
    __esModule: true,
    default: (loader: () => unknown) => {
      const source = String(loader);
      if (source.includes('TableGuestVisitBlocked')) {
        function MockBlockedVisit({ phase }: { readonly phase: string }) {
          return React.createElement('main', { 'data-testid': 'table-visit-blocked' }, phase);
        }
        return MockBlockedVisit;
      }
      if (source.includes('TableGuestRouteRuntimeLoader')) {
        function MockRuntimeLoader({ children }: { readonly children: React.ReactNode }) {
          return React.createElement(React.Fragment, null, children);
        }
        return MockRuntimeLoader;
      }
      function MockUnusedDynamicComponent() {
        return null;
      }
      return MockUnusedDynamicComponent;
    },
  };
});

const styles: CheckoutReviewStyles = {
  page: { container: 'container', loadingState: 'loading', spinner: 'spinner' },
  orderType: {},
  customerInfo: {},
  orderItems: {},
  payment: {},
  tip: {},
  summary: {},
};

it('renders pending-operation recovery when a non-dine-in visit read is unavailable', () => {
  render(<CheckoutReviewLayout styles={styles} />);

  expect(screen.getByTestId('table-visit-blocked')).toHaveTextContent('unavailable');
  expect(screen.queryByText('Review Your Order')).not.toBeInTheDocument();
});
