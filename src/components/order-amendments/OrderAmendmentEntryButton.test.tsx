import { render, screen } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import OrderAmendmentEntryButton from './OrderAmendmentEntryButton';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/contexts/TenantFeaturesContext', () => ({
  useTenantFeatures: () => ({ orderAmendmentsV1: true }),
}));

const order = (type: string, overrides: Partial<OrderDto> = {}) =>
  ({
    id: 'order-1',
    orderNumber: 'A-001',
    type,
    status: 'Ready',
    paymentStatus: 'PartiallyPaid',
    version: 1,
    items: [],
    ...overrides,
  }) as OrderDto;

describe('OrderAmendmentEntryButton', () => {
  it.each(['DineIn', 'Takeaway', 'Delivery'])('provides a native %s order entry for Server and Cashier', (type) => {
    const { unmount } = render(<OrderAmendmentEntryButton order={order(type)} operatorRole="Server" />);
    expect(screen.getByRole('button', { name: 'orderAmendments.open' })).toBeInTheDocument();
    unmount();

    render(<OrderAmendmentEntryButton order={order(type)} operatorRole="Cashier" />);
    expect(screen.getByRole('button', { name: 'orderAmendments.open' })).toBeInTheDocument();
  });

  it('explains terminal and refund-reconciliation states instead of exposing an amendment action', () => {
    const { rerender } = render(
      <OrderAmendmentEntryButton order={order('DineIn', { status: 'Cancelled' })} operatorRole="Server" />,
    );
    expect(screen.getByText('orderAmendments.cancelled_order')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<OrderAmendmentEntryButton order={order('DineIn', { status: 'Refunded' })} operatorRole="Cashier" />);
    expect(screen.getByText('orderAmendments.fully_refunded_order')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <OrderAmendmentEntryButton
        order={order('DineIn', { status: 'Completed', paymentStatus: 'Refunded' })}
        operatorRole="Cashier"
      />,
    );
    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <OrderAmendmentEntryButton
        order={order('Takeaway', {
          status: 'Completed',
          paymentStatus: 'PartiallyPaid',
          payments: [
            {
              id: 'payment-1',
              orderId: 'order-1',
              paymentMethod: PaymentMethod.Cash,
              amount: 10,
              status: 'PartiallyRefunded',
            },
          ],
        })}
        operatorRole="Cashier"
      />,
    );
    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <OrderAmendmentEntryButton
        order={order('Delivery', {
          status: 'Completed',
          payments: [
            {
              id: 'payment-1',
              orderId: 'order-1',
              paymentMethod: PaymentMethod.Cash,
              amount: 10,
              status: 'Completed',
              refundedAmount: 0,
            },
          ],
        })}
        operatorRole="Admin"
      />,
    );
    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
