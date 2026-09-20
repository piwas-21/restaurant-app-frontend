import { render, screen } from '@testing-library/react';
import OrderReviewStatus from './OrderReviewStatus';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallbackOrOptions?: string | (Record<string, string | number> & { defaultValue?: string }),
      extraValues?: Record<string, string | number>,
    ) => {
      const fallback =
        typeof fallbackOrOptions === 'string' ? fallbackOrOptions : (fallbackOrOptions?.defaultValue ?? key);
      const values = typeof fallbackOrOptions === 'object' ? fallbackOrOptions : extraValues;
      if (key === 'checkout.review_received_body') {
        const count = Number(values?.count ?? 0);
        return `The restaurant is reviewing it. We usually reply within ${count} ${count === 1 ? 'minute' : 'minutes'}.`;
      }
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        fallback,
      );
    },
    i18n: { language: 'en' },
  }),
}));

describe('OrderReviewStatus', () => {
  it('shows a bounded review window only for the acknowledge flow', () => {
    const { container, rerender } = render(
      <OrderReviewStatus
        confirmationFlow="acknowledge"
        status="Pending"
        reviewWindowMinutes={2}
        total={31.5}
        currency="CHF"
      />,
    );

    expect(screen.getByRole('heading', { name: 'We have received your order' })).toBeInTheDocument();
    expect(screen.getByText('order_status_pending')).toBeInTheDocument();
    expect(screen.getByText(/within 2 minutes/)).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"] span')).not.toBeNull();

    rerender(<OrderReviewStatus confirmationFlow="direct" status="Pending" reviewWindowMinutes={2} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses singular review-window copy for one minute', () => {
    render(<OrderReviewStatus confirmationFlow="acknowledge" status="Pending" reviewWindowMinutes={1} />);

    expect(screen.getByText(/within 1 minute\./)).toBeInTheDocument();
    expect(screen.queryByText(/1 minutes/)).not.toBeInTheDocument();
  });

  it('replaces the review state with the approved ready time', () => {
    render(
      <OrderReviewStatus
        confirmationFlow="acknowledge"
        status="Confirmed"
        estimatedDeliveryTime="2026-09-20T12:30:00Z"
        reviewWindowMinutes={2}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Your order is approved' })).toBeInTheDocument();
    expect(screen.getByText('order_status_confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Expected ready time:/)).toBeInTheDocument();
    expect(screen.queryByText('We have received your order')).not.toBeInTheDocument();
  });

  it('shows the existing customer-action step for a preparation time over ten minutes', () => {
    render(
      <OrderReviewStatus
        confirmationFlow="acknowledge"
        status="PendingApproval"
        estimatedDeliveryTime="2026-09-20T13:00:00Z"
        reviewWindowMinutes={2}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Please approve the longer wait' })).toBeInTheDocument();
    expect(screen.getByText(/Check your email to respond/)).toBeInTheDocument();
    expect(screen.queryByText('We have received your order')).not.toBeInTheDocument();
  });

  it('renders a cancellation without exposing any private order fields', () => {
    render(<OrderReviewStatus confirmationFlow="acknowledge" status="Cancelled" reviewWindowMinutes={2} />);

    expect(screen.getByRole('heading', { name: 'The restaurant could not accept this order' })).toBeInTheDocument();
    expect(screen.getByText('order_status_cancelled')).toBeInTheDocument();
    expect(screen.getByText(/cancellation details/)).toBeInTheDocument();
  });
});
