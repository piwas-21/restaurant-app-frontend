import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PaymentMethod } from '@/types/order';
import OrderConfirmationModal from './OrderConfirmationModal';

const mockUseGuestOrderWatch = jest.fn();

jest.mock('@/hooks/checkout/useGuestOrderWatch', () => ({
  useGuestOrderWatch: (...args: unknown[]) => mockUseGuestOrderWatch(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallbackOrOptions?: string | (Record<string, string | number> & { defaultValue?: string }),
      extraValues?: Record<string, string | number>,
    ) => {
      if (key === 'payment_card_at_restaurant_reminder') {
        return 'Veuillez payer par carte au restaurant. Pas encore payé.';
      }
      const fallback =
        typeof fallbackOrOptions === 'string' ? fallbackOrOptions : (fallbackOrOptions?.defaultValue ?? key);
      const values = typeof fallbackOrOptions === 'object' ? fallbackOrOptions : extraValues;
      if (key === 'checkout.review_received_body') {
        const count = Number(values?.count ?? 0);
        return `The restaurant is reviewing it. We usually reply within ${count} minutes.`;
      }
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        fallback,
      );
    },
    i18n: { language: 'en' },
  }),
}));

describe('OrderConfirmationModal payment reminder', () => {
  const props = {
    isOpen: true,
    orderId: 'order-id',
    orderNumber: 'ORD-1',
    customerEmail: '',
    guestStatusToken: 'read-token',
    confirmationFlow: 'direct' as const,
    isLoggedIn: false,
    onClose: jest.fn(),
    onTrackOrder: jest.fn(),
  };

  beforeEach(() => {
    mockUseGuestOrderWatch.mockReturnValue({ status: null, phase: 'loading' });
  });

  it('shows the translated card-at-restaurant reminder without claiming payment', () => {
    render(<OrderConfirmationModal {...props} paymentMethod={PaymentMethod.CreditCard} />);

    expect(screen.getByRole('note')).toHaveTextContent('Veuillez payer par carte au restaurant. Pas encore payé.');
    expect(screen.getByRole('note')).toHaveTextContent(/pas encore payé/i);
  });

  it('does not show the card reminder for cash orders', () => {
    render(<OrderConfirmationModal {...props} paymentMethod={PaymentMethod.Cash} />);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('shows the reviewed-order countdown returned by the guest status endpoint', () => {
    mockUseGuestOrderWatch.mockReturnValue({
      phase: 'reviewing',
      status: {
        orderNumber: 'ORD-1',
        type: 'Takeaway',
        status: 'Pending',
        confirmationFlow: 'acknowledge',
        reviewWindowMinutes: 3,
        reviewDeadlineUtc: null,
      },
    });

    render(<OrderConfirmationModal {...props} confirmationFlow="acknowledge" paymentMethod={PaymentMethod.Cash} />);

    expect(screen.getByText(/within 3 minutes/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/start preparing/i)).not.toBeInTheDocument();
  });

  it('updates the same modal when the restaurant approves the order', () => {
    mockUseGuestOrderWatch.mockReturnValue({
      phase: 'reviewing',
      status: {
        orderNumber: 'ORD-1',
        type: 'Takeaway',
        status: 'Pending',
        confirmationFlow: 'acknowledge',
        reviewWindowMinutes: 3,
        reviewDeadlineUtc: null,
      },
    });

    const { rerender } = render(
      <OrderConfirmationModal {...props} confirmationFlow="acknowledge" paymentMethod={PaymentMethod.Cash} />,
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    mockUseGuestOrderWatch.mockReturnValue({
      phase: 'approved',
      status: {
        orderNumber: 'ORD-1',
        type: 'Takeaway',
        status: 'Confirmed',
        confirmationFlow: 'acknowledge',
        reviewWindowMinutes: 3,
        reviewDeadlineUtc: null,
      },
    });
    rerender(<OrderConfirmationModal {...props} confirmationFlow="acknowledge" paymentMethod={PaymentMethod.Cash} />);

    expect(screen.getByRole('heading', { name: 'Your order is approved' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/start preparing/i)).not.toBeInTheDocument();
  });

  it('updates the same modal when the restaurant rejects the order', () => {
    mockUseGuestOrderWatch.mockReturnValue({
      phase: 'decided',
      status: {
        orderNumber: 'ORD-1',
        type: 'Takeaway',
        status: 'Cancelled',
        confirmationFlow: 'acknowledge',
        reviewWindowMinutes: 3,
        reviewDeadlineUtc: null,
      },
    });

    render(<OrderConfirmationModal {...props} confirmationFlow="acknowledge" paymentMethod={PaymentMethod.Cash} />);

    expect(screen.getByRole('heading', { name: 'The restaurant could not accept this order' })).toBeInTheDocument();
    expect(screen.queryByText(/start preparing/i)).not.toBeInTheDocument();
  });
});
