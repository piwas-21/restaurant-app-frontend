import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import RefundDialog from './RefundDialog';
import type { OrderDto, OrderPaymentDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';

// Echoes the key plus any interpolation, so a missing key shows up as a key AND an assertion on
// the gateway name still has something to match. `t` must be stable across renders, or every
// consumer re-renders forever.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' && 'gateway' in opts ? `${key}:${opts.gateway}` : key,
  }),
}));

const payment = (over: Partial<OrderPaymentDto>): OrderPaymentDto =>
  ({
    id: 'p1',
    orderId: 'o1',
    paymentMethod: PaymentMethod.Cash,
    amount: 40,
    status: 'Completed',
    paymentDate: '2026-08-10T12:00:00Z',
    ...over,
  }) as OrderPaymentDto;

const open = (payments: OrderPaymentDto[]) =>
  render(
    <RefundDialog
      isOpen
      order={{ id: 'o1', orderNumber: 'A-1', payments } as unknown as OrderDto}
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      isLoading={false}
    />,
  );

/**
 * S11. `RefundPaymentCommand` refuses a tender captured by a payment gateway — the platform's
 * Stripe key has no refunds write, so booking one would report money returned that never left
 * Stripe. This dialog must not offer what the server will refuse.
 */
describe('RefundDialog — gateway-held tenders', () => {
  it('does not offer a Stripe tender for refund', () => {
    open([payment({ id: 'stripe', paymentMethod: PaymentMethod.OnlinePayment, paymentGateway: 'Stripe' })]);

    // Asserted on the rendered AMOUNT, not on the section label. The label renders as
    // "cashier.select_payment *", so a `getByText('cashier.select_payment')` never matches — and a
    // NEGATIVE assertion on it therefore passes whether the list is there or not. The amount is
    // the only text unique to a selectable row, and it is what a cashier picks by.
    expect(screen.queryByText('40.00')).not.toBeInTheDocument();
    expect(screen.queryByText('cashier.process_refund')).not.toBeInTheDocument();
  });

  it('says where the refund IS made, naming the gateway from the row', () => {
    open([payment({ id: 'stripe', paymentMethod: PaymentMethod.OnlinePayment, paymentGateway: 'Stripe' })]);

    expect(screen.getByText('gateway_refund_notice:Stripe')).toBeInTheDocument();
  });

  it('does not tell a cashier the paid order has no payments', () => {
    // The failure this replaces: filtering the tender out alone left the pre-existing empty-state
    // message, so a cashier looking at an order the diner definitely paid was told there was
    // nothing there — which reads as lost money, not as "refund it elsewhere".
    open([payment({ id: 'stripe', paymentMethod: PaymentMethod.OnlinePayment, paymentGateway: 'Stripe' })]);

    expect(screen.queryByText('cashier.no_refundable_payments')).not.toBeInTheDocument();
  });

  it('still offers a till tender — the control', () => {
    // Without this, "hide gateway tenders" is satisfied by a dialog that hides everything.
    open([payment({ id: 'cash' })]);

    expect(screen.getByText('40.00')).toBeInTheDocument();
    expect(screen.getByText('cashier.process_refund')).toBeInTheDocument();
    expect(screen.queryByText(/^gateway_refund_notice/)).not.toBeInTheDocument();
  });

  it('offers only the till half of a mixed order, and still explains the other half', () => {
    open([
      payment({ id: 'cash', amount: 5 }),
      payment({ id: 'stripe', paymentMethod: PaymentMethod.OnlinePayment, amount: 40, paymentGateway: 'Stripe' }),
    ]);

    // Amounts rather than ids: the ids are ours, the rendered figure is what a cashier picks by.
    expect(screen.getByText('5.00')).toBeInTheDocument();
    expect(screen.queryByText('40.00')).not.toBeInTheDocument();
    expect(screen.getByText('gateway_refund_notice:Stripe')).toBeInTheDocument();
  });

  it('selects a till tender when it is clicked, opening the amount form', () => {
    // The picker moved out of the dialog in this slice, so selection now crosses a component
    // boundary. If the callback were dropped in the move, every assertion above would still pass
    // and no cashier could refund anything.
    open([payment({ id: 'cash' })]);

    // `cashier.partial_refund` and not `cashier.refund_type`: the latter renders as
    // "cashier.refund_type *", which getByText's exact match never finds — so both the before and
    // the after would have "passed" while proving nothing.
    expect(screen.queryByText('cashier.partial_refund')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('40.00'));
    expect(screen.getByText('cashier.partial_refund')).toBeInTheDocument();
  });

  it('renders a tender that carries no amount or date without crashing', () => {
    // `paymentDate` is optional on the DTO and an amount can legitimately be 0, so the picker's
    // two fallbacks are reachable rows, not defensive decoration.
    open([payment({ id: 'cash', amount: 0, paymentDate: undefined })]);

    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('keeps offering a tender whose gateway field is blank rather than absent', () => {
    // `AddPaymentToOrderCommand` takes the gateway as free text from the till body, so an empty
    // string is reachable and is NOT a gateway capture. Treating it as one would silently make a
    // real till refund impossible.
    open([payment({ id: 'cash', paymentGateway: '   ' })]);

    expect(screen.getByText('40.00')).toBeInTheDocument();
  });

  it('ignores a gateway tender that is not Completed, exactly as the status filter already did', () => {
    // A Processing online tender is money still in flight at Stripe. It was already excluded by
    // status; the custody split must not resurrect it into the notice as though it were settled.
    open([
      payment({
        id: 'inflight',
        paymentMethod: PaymentMethod.OnlinePayment,
        status: 'Processing',
        paymentGateway: 'Stripe',
      }),
    ]);

    expect(screen.queryByText(/^gateway_refund_notice/)).not.toBeInTheDocument();
    expect(screen.getByText('cashier.no_refundable_payments')).toBeInTheDocument();
  });
});
