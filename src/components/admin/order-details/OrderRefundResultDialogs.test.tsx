import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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

const open = (payments: OrderPaymentDto[], selectedPayment: string | null = null) =>
  render(
    <OrderRefundResultDialogs
      order={{ id: 'o1', orderNumber: 'A-1', payments } as unknown as OrderDto}
      showRefundModal
      setShowRefundModal={jest.fn()}
      selectedPayment={selectedPayment}
      setSelectedPayment={jest.fn()}
      refundAmount=""
      setRefundAmount={jest.fn()}
      refundTipAmount="0.00"
      setRefundTipAmount={jest.fn()}
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

  it('shows the separate staff-tip refund field only for a tender that collected a tip', () => {
    open([payment({ id: 'cash-tip', tipMinor: 325 })], 'cash-tip');

    expect(screen.getByRole('spinbutton', { name: /cashier\.refund_tip_amount/ })).toHaveAttribute('max', '3.25');
    expect(screen.getByText(/cashier\.refund_tip_note/)).toHaveTextContent('cashier.refund_tip_exceeds_payment');
  });

  it('warns that a tender has one refund action before confirmation', () => {
    open([payment({ id: 'cash-tip', tipMinor: 325 })]);

    expect(screen.getByText('cashier.refund_single_event_warning')).toBeInTheDocument();
  });

  it('defaults the refund to the full selected order amount and remaining staff tip', () => {
    const setRefundAmount = jest.fn();
    const setRefundTipAmount = jest.fn();
    render(
      <OrderRefundResultDialogs
        order={
          {
            id: 'o1',
            orderNumber: 'A-1',
            payments: [payment({ id: 'cash-tip', tipMinor: 325 })],
          } as unknown as OrderDto
        }
        showRefundModal
        setShowRefundModal={jest.fn()}
        selectedPayment={null}
        setSelectedPayment={jest.fn()}
        refundAmount=""
        setRefundAmount={setRefundAmount}
        refundTipAmount="0.00"
        setRefundTipAmount={setRefundTipAmount}
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

    fireEvent.change(screen.getByLabelText(/select_payment/), { target: { value: 'cash-tip' } });

    expect(setRefundAmount).toHaveBeenCalledWith('40.00');
    expect(setRefundTipAmount).toHaveBeenCalledWith('3.25');
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
    expect(screen.queryByRole('option', { name: /inflight/ })).not.toBeInTheDocument();
  });

  it('does not offer a tender that already used its one refund event', () => {
    open([payment({ id: 'partial', status: 'PartiallyRefunded', refundedAmount: 1 })]);

    expect(screen.queryByRole('option', { name: /partial/ })).not.toBeInTheDocument();
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
