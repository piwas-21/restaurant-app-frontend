import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import CashierCollectionPanel from './CashierCollectionPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key),
    i18n: { language: 'en' },
  }),
}));

const order = (overrides: Partial<OrderDto> = {}): OrderDto =>
  ({
    id: 'order-1',
    orderNumber: '1042',
    type: 'Takeaway',
    total: 18.5,
    totalPaid: 0,
    remainingAmount: 18.5,
    isFullyPaid: false,
    status: 'Completed',
    paymentStatus: 'Pending',
    isFocusOrder: false,
    hasUserLimitDiscount: false,
    userLimitAmount: 0,
    subTotal: 18.5,
    tax: 0,
    deliveryFee: 0,
    discount: 0,
    discountPercentage: 0,
    customerDiscountAmount: 0,
    tip: 0,
    orderDate: '2026-09-13T10:00:00Z',
    items: [],
    payments: [],
    statusHistory: [],
    currency: 'EUR',
    ...overrides,
  }) as OrderDto;

const renderPanel = (
  onSubmit = jest.fn().mockResolvedValue(order({ remainingAmount: 0, totalPaid: 18.5 })),
  overrides = {},
) =>
  render(
    <CashierCollectionPanel
      order={order(overrides)}
      isPending={false}
      isCheckingPayment={false}
      onSubmit={onSubmit}
      onBack={jest.fn()}
      onNextSale={jest.fn()}
      onReturnToOrder={jest.fn()}
    />,
  );

describe('CashierCollectionPanel', () => {
  it('defaults to the full due amount and keeps denomination suggestions in received cash', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: '1042' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /cashier.payment_amount/ })).toHaveValue('18.50');
    expect(screen.getByRole('textbox', { name: 'cashier.cash_received' })).toHaveValue('18.50');

    fireEvent.click(screen.getByRole('button', { name: /EUR.*20\.00/ }));

    expect(screen.getByRole('textbox', { name: /cashier.payment_amount/ })).toHaveValue('18.50');
    expect(screen.getByRole('textbox', { name: 'cashier.cash_received' })).toHaveValue('20.00');
  });

  it('submits one applied amount and retains the form after a definitive failure', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Terminal offline'));
    renderPanel(onSubmit);
    fireEvent.change(screen.getByRole('textbox', { name: 'cashier.notes' }), {
      target: { value: 'keep this note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 18.5 }), expect.any(Number)),
    );
    expect(await screen.findAllByText('Terminal offline')).not.toHaveLength(0);
    expect(screen.getByRole('textbox', { name: 'cashier.notes' })).toHaveValue('keep this note');
    expect(screen.getByRole('textbox', { name: /cashier.payment_amount/ })).toHaveValue('18.50');
  });

  it('offers the saved-order route without labeling recovery as an active tender', () => {
    const openRecoveryOrder = jest.fn();
    render(
      <CashierCollectionPanel
        order={order()}
        isPending
        isCheckingPayment={false}
        recoveryError="cashier.payment_recovery_other_order"
        recoveryOrderId="order-original"
        onSubmit={jest.fn()}
        onBack={jest.fn()}
        onNextSale={jest.fn()}
        onReturnToOrder={jest.fn()}
        onOpenRecoveryOrder={openRecoveryOrder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'cashier.payment_recovery_open_order' }));

    expect(openRecoveryOrder).toHaveBeenCalledWith('order-original');
    expect(screen.getByRole('button', { name: 'cashier.add_payment' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'common.loading' })).not.toBeInTheDocument();
  });

  it('keeps unreadable recovery blocked while showing an enabled check action, not a sending label', () => {
    render(
      <CashierCollectionPanel
        order={order()}
        isPending
        isCheckingPayment={false}
        recoveryError="cashier.payment_recovery_unreadable"
        onSubmit={jest.fn()}
        onBack={jest.fn()}
        onNextSale={jest.fn()}
        onReturnToOrder={jest.fn()}
        onRetryPendingPayment={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('cashier.payment_recovery_unreadable');
    expect(screen.getByRole('button', { name: 'cashier.collection.retry_payment_check' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'cashier.add_payment' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'common.loading' })).not.toBeInTheDocument();
  });

  it('adds the staff tip to cash due and change without increasing the order balance', async () => {
    const onSubmit = jest.fn().mockResolvedValue(order({ remainingAmount: 0, totalPaid: 18.5 }));
    renderPanel(onSubmit);

    fireEvent.change(screen.getByLabelText(/custom_tip/), {
      target: { value: '1.25' },
    });

    expect(screen.getByRole('textbox', { name: 'cashier.cash_received' })).toHaveValue('19.75');
    expect(screen.getByText(/cashier.collection.total_to_collect/)).toHaveTextContent('EUR 19.75');
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 18.5,
          tipMinor: 125,
        }),
        expect.any(Number),
      ),
    );
  });

  it('recalculates exact cash due after switching methods and editing the draft', async () => {
    const onSubmit = jest.fn().mockResolvedValue(order({ remainingAmount: 1.5, totalPaid: 18.5 }));
    renderPanel(onSubmit, { total: 20, remainingAmount: 20 });

    const method = screen.getByRole('combobox', { name: /cashier.payment_method/ });
    fireEvent.change(method, { target: { value: 'CreditCard' } });
    fireEvent.change(screen.getByRole('textbox', { name: /cashier.payment_amount/ }), {
      target: { value: '18.50' },
    });
    fireEvent.change(screen.getByLabelText(/custom_tip/), {
      target: { value: '2.25' },
    });

    fireEvent.change(method, { target: { value: 'Cash' } });
    const received = screen.getByRole('textbox', { name: 'cashier.cash_received' });
    expect(received).toHaveValue('20.75');
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 18.5, tipMinor: 225 }),
        expect.any(Number),
      ),
    );
  });

  it('labels card recording without offering an online capture method', () => {
    renderPanel();
    fireEvent.change(screen.getByRole('combobox', { name: /cashier.payment_method/ }), {
      target: { value: 'CreditCard' },
    });

    expect(screen.getByText('cashier.standalone_card_instruction')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cashier.record_card_payment' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /online/i })).not.toBeInTheDocument();
  });

  it('locks dismissal and fields while a payment outcome is pending', () => {
    render(
      <CashierCollectionPanel
        order={order()}
        isPending
        isCheckingPayment
        onSubmit={jest.fn()}
        onBack={jest.fn()}
        onNextSale={jest.fn()}
        onReturnToOrder={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'cashier.collection.back_orders' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'cashier.payment_checking' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /cashier.payment_amount/ })).toBeDisabled();
  });

  it('offers reconciliation but never clears an unknown tender from the browser', () => {
    render(
      <CashierCollectionPanel
        order={order()}
        isPending={false}
        isCheckingPayment={false}
        pendingPayment={{
          orderId: 'order-1',
          operationId: 'operation-1',
          paymentMethod: 'Cash',
          amount: 18.5,
          status: 'Unknown',
        }}
        onSubmit={jest.fn()}
        onBack={jest.fn()}
        onNextSale={jest.fn()}
        onReturnToOrder={jest.fn()}
        onRetryPendingPayment={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'cashier.collection.retry_payment_check' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'cashier.collection.abandon_payment' })).not.toBeInTheDocument();
  });
});
