import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import CashierCollectionPanel from './CashierCollectionPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key),
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
    expect(screen.getByRole('spinbutton', { name: /cashier.payment_amount/ })).toHaveValue(18.5);
    expect(screen.getByRole('spinbutton', { name: 'cashier.cash_received' })).toHaveValue(18.5);

    const twenty = screen.getAllByRole('button').find((button) => button.textContent?.includes('20'));
    expect(twenty).toBeDefined();
    fireEvent.click(twenty!);

    expect(screen.getByRole('spinbutton', { name: /cashier.payment_amount/ })).toHaveValue(18.5);
    expect(screen.getByRole('spinbutton', { name: 'cashier.cash_received' })).toHaveValue(20);
  });

  it('submits one applied amount and retains the form after a definitive failure', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Terminal offline'));
    renderPanel(onSubmit);
    fireEvent.change(screen.getByRole('textbox', { name: 'cashier.notes' }), {
      target: { value: 'keep this note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 18.5 })));
    expect(await screen.findAllByText('Terminal offline')).not.toHaveLength(0);
    expect(screen.getByRole('textbox', { name: 'cashier.notes' })).toHaveValue('keep this note');
    expect(screen.getByRole('spinbutton', { name: /cashier.payment_amount/ })).toHaveValue(18.5);
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
    expect(screen.getByRole('spinbutton', { name: /cashier.payment_amount/ })).toBeDisabled();
  });
});
