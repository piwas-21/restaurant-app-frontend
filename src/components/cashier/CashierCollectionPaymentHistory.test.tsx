import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PaymentMethod, type OrderDto, type OrderPaymentDto } from '@/types/order';
import CashierCollectionPaymentHistory from './CashierCollectionPaymentHistory';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.amount ? `${key}: ${String(options.amount)}` : key,
  }),
}));

describe('CashierCollectionPaymentHistory', () => {
  it('shows net tip summary and net collected tender with the refunded tip stated separately', () => {
    const payment: OrderPaymentDto = {
      id: 'payment-1',
      orderId: 'order-1',
      paymentMethod: PaymentMethod.Cash,
      amount: 20,
      tipMinor: 125,
      refundedAmount: 0,
      refundedTipMinor: 50,
      status: 'PartiallyRefunded',
    };
    const order = {
      id: 'order-1',
      currency: 'EUR',
      total: 20,
      totalPaid: 20,
      paymentTipMinor: 75,
      payments: [payment],
    } as OrderDto;

    render(<CashierCollectionPaymentHistory order={order} />);

    expect(screen.getByText('EUR 0.75')).toBeInTheDocument();
    expect(screen.getByText('cashier.collection.tip_refunded: EUR 0.50')).toBeInTheDocument();
    expect(screen.getByText('cashier.collection.total_collected: EUR 20.75')).toBeInTheDocument();
  });
});
