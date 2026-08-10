import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderRefundResultDialogs from './OrderRefundResultDialogs';
import type { OrderDto, OrderPaymentDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: unknown) =>
      fallbackOrOpts && typeof fallbackOrOpts === 'object' && 'gateway' in (fallbackOrOpts as object)
        ? `${key}:${(fallbackOrOpts as { gateway: string }).gateway}`
        : key,
  }),
}));

const payment = (over: Partial<OrderPaymentDto>): OrderPaymentDto =>
  ({
    id: 'p1',
    orderId: 'o1',
    paymentMethod: PaymentMethod.Cash,
    amount: 40,
    status: 'Completed',
    ...over,
  }) as OrderPaymentDto;

const open = (payments: OrderPaymentDto[]) =>
  render(
    <OrderRefundResultDialogs
      order={{ id: 'o1', orderNumber: 'A-1', payments } as unknown as OrderDto}
      showRefundModal
      setShowRefundModal={jest.fn()}
      selectedPayment={null}
      setSelectedPayment={jest.fn()}
      refundAmount=""
      setRefundAmount={jest.fn()}
      refundReason=""
      setRefundReason={jest.fn()}
      isRefunding={false}
      onRefundPayment={jest.fn()}
      showSuccessModal={false}
      onSuccessClose={jest.fn()}
      showCancelSuccessModal={false}
      onCancelSuccessClose={jest.fn()}
      error=""
      clearError={jest.fn()}
    />,
  );

/**
 * The admin surface of S11. It is a second, independent route to the same refused endpoint — a
 * guard on the cashier dialog alone would leave this one handing an admin a button that always
 * fails, which is how "we fixed that" and "it still happens" are both true.
 */
describe('OrderRefundResultDialogs — gateway-held tenders', () => {
  it('leaves a Stripe tender out of the payment select', () => {
    open([payment({ id: 'stripe', paymentMethod: PaymentMethod.OnlinePayment, paymentGateway: 'Stripe' })]);

    // The option's own label carries the amount; its absence is what proves the row is gone,
    // rather than the select merely being empty for some other reason.
    expect(screen.queryByRole('option', { name: /40/ })).not.toBeInTheDocument();
  });

  it('says which dashboard the refund is made in', () => {
    open([payment({ id: 'stripe', paymentMethod: PaymentMethod.OnlinePayment, paymentGateway: 'Stripe' })]);

    expect(screen.getByText('gateway_refund_notice:Stripe')).toBeInTheDocument();
  });

  it('still lists a till tender, and shows no notice — the control', () => {
    open([payment({ id: 'cash' })]);

    expect(screen.getByRole('option', { name: /40/ })).toBeInTheDocument();
    expect(screen.queryByText(/^gateway_refund_notice/)).not.toBeInTheDocument();
  });

  it('says nothing about a gateway for a tender that is still Processing', () => {
    // Money in flight at Stripe is not money to go and refund. The cashier surface derives its
    // notice from Completed tenders only; deriving this one from the raw list instead pointed an
    // admin at a dashboard refund for a charge that had not been captured.
    open([
      payment({
        id: 'inflight',
        paymentMethod: PaymentMethod.OnlinePayment,
        status: 'Processing',
        paymentGateway: 'Stripe',
      }),
    ]);

    expect(screen.queryByText(/^gateway_refund_notice/)).not.toBeInTheDocument();
  });

  it('says nothing about a gateway for a tender that was already refunded', () => {
    open([
      payment({ id: 'done', paymentMethod: PaymentMethod.OnlinePayment, status: 'Refunded', paymentGateway: 'Stripe' }),
    ]);

    expect(screen.queryByText(/^gateway_refund_notice/)).not.toBeInTheDocument();
  });

  it('survives an order with no payments array at all', () => {
    // AlertDialog evaluates its children on every render, even closed, so this path runs on every
    // order-details view — the reason the original code optional-chained here.
    expect(() => open(undefined as unknown as OrderPaymentDto[])).not.toThrow();
  });
});
