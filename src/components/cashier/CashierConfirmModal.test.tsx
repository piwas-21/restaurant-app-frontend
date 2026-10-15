import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import CashierConfirmModal from './CashierConfirmModal';

const labels: Record<string, string> = {
  'cashier.approve_order_title': 'Approve order',
  'cashier.approve_order_action': 'Approve order',
  'cashier.approve_with_preparation': 'Approve with estimated {{minutes}} min',
  'cashier.approve_preset_minutes': '{{minutes}} min',
  'cashier.confirm_preset_minutes': '{{minutes}} min',
  'cashier.confirm_order_title': 'Confirm order',
  'cashier.confirm_order_action': 'Confirm order',
  'cashier.confirm_with_estimated_preparation': 'Confirm with estimated {{minutes}} min',
  'cashier.choose_preparation_time': 'Choose the preparation time',
  'cashier.confirm_now': 'Confirm now',
  'cashier.confirm_with_preparation': 'Confirm with preparation time',
  'cashier.confirm_custom_minutes_invalid': 'Enter 1 to 600 minutes',
  'cashier.cancel_order_confirm_title': 'Cancel this order?',
  'cashier.reject_order_action': 'Reject order',
  'cashier.reject_order_confirm_title': 'Reject this order?',
  'cashier.reject_order_warning': 'The customer will be notified.',
  'cashier.workspace.channel_takeaway': 'Takeaway',
  'cashier.workspace.guest': 'Guest',
  'cashier.workspace.order_total': 'Total',
  'cashier.workspace.items': 'Items',
  'cashier.workspace.no_items': 'No items recorded.',
  'cashier.workspace.customer_details': 'Customer details',
  'cashier.workspace.notes': 'Notes',
  'cashier.workspace.delivery_address': 'Delivery address',
  'cashier.workspace.technical_reference': 'Technical reference',
  'orders.preparation_estimate': 'Preparation estimate: {{minutes}} min',
  order_number: 'Order number',
  type: 'Type',
  customer: 'Customer',
  phone: 'Phone',
  email: 'Email',
  custom_minutes: 'Custom minutes',
  'common.confirm': 'Confirm',
  cancel_order: 'Cancel order',
  cancellation_reason: 'Cancellation reason',
  cancellation_reason_placeholder: 'Why?',
  cancel_order_warning: 'This cannot be undone.',
  provide_cancellation_reason: 'Please provide a cancellation reason',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      const template = labels[key] ?? key;
      return template.replace('{{minutes}}', String(values?.minutes ?? ''));
    },
  }),
}));

const order = {
  id: 'order-id',
  orderNumber: 'ORD-42',
  dailyOrderNumber: 42,
  customerName: 'Ada',
  customerEmail: 'ada@example.test',
  customerPhone: '+41 79 555 01 02',
  status: 'Pending',
  type: 'Takeaway',
  total: 31.5,
  items: [{ id: 'line-1', quantity: 2, productName: 'Soup', itemTotal: 16, unitPrice: 8 }],
  notes: 'No onions',
  deliveryAddress: { fullAddress: 'Rue du Test 1, Geneva' },
  payments: [],
  statusHistory: [],
} as unknown as OrderDto;

const setup = (flow: 'direct' | 'acknowledge' = 'acknowledge', orderOverride: OrderDto = order) => {
  const onClose = jest.fn();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onReject = jest.fn().mockResolvedValue(undefined);
  render(
    <CashierConfirmModal
      order={orderOverride}
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      onReject={onReject}
      confirmationFlow={flow}
    />,
  );
  return { onClose, onConfirm, onReject };
};

describe('CashierConfirmModal', () => {
  it('shows the full order ticket in an accessible detail section and keeps the full ID in a disclosure', () => {
    setup();

    expect(screen.getByRole('region', { name: 'Items' })).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('ada@example.test')).toBeInTheDocument();
    expect(screen.getByText('+41 79 555 01 02')).toBeInTheDocument();
    expect(screen.getByText('Rue du Test 1, Geneva')).toBeInTheDocument();
    expect(screen.getByText('No onions')).toBeInTheDocument();
    const technicalDetails = screen.getByText('order-id').closest('details');
    expect(technicalDetails).not.toHaveAttribute('open');
    expect(technicalDetails).toHaveTextContent('Order number: ORD-42');
    fireEvent.click(screen.getByText('Technical reference'));
    expect(technicalDetails).toHaveAttribute('open');
    expect(screen.getByText('order-id')).toBeInTheDocument();
  });

  it('uses approve wording for acknowledge flow and requires a preparation time', async () => {
    const { onClose, onConfirm } = setup();
    expect(screen.getByRole('heading', { name: 'Approve order' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm now' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '15 min' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', 15));
    expect(onClose).toHaveBeenCalled();
  });

  it('approves with the saved preparation estimate and pins the decision beside long details', async () => {
    const estimatedOrder = { ...order, effectivePreparationMinutes: 18 } as OrderDto;
    const { onConfirm } = setup('acknowledge', estimatedOrder);
    const approve = screen.getByRole('button', { name: 'Approve with estimated 18 min' });
    const dialog = screen.getByRole('dialog');
    const footer = dialog.children.item(2);
    const body = dialog.children.item(1);

    expect(screen.getByText('Preparation estimate: 18 min')).toBeInTheDocument();
    expect(footer).toContainElement(approve);
    expect(body).not.toContainElement(approve);

    fireEvent.click(approve);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', 18));
  });

  it('lets the backend resolve preparation when no estimate is known', async () => {
    const unknownOrder = { ...order, effectivePreparationMinutes: null } as OrderDto;
    const { onConfirm } = setup('acknowledge', unknownOrder);

    fireEvent.click(screen.getAllByRole('button', { name: 'Approve order' })[1]);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', null));
  });

  it('preserves an explicit zero-minute override', async () => {
    const zeroEstimateOrder = { ...order, effectivePreparationMinutes: 0 } as OrderDto;
    const { onConfirm } = setup('acknowledge', zeroEstimateOrder);

    fireEvent.click(screen.getByRole('button', { name: 'Approve with estimated 0 min' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', 0));
  });

  it('keeps approval and rejection reachable when a long ticket fills the scroll body', () => {
    const longOrder = {
      ...order,
      effectivePreparationMinutes: 18,
      items: Array.from({ length: 35 }, (_, index) => ({
        id: `line-${index}`,
        quantity: 1,
        productName: `Soup ${index}`,
        itemTotal: 8,
        unitPrice: 8,
      })),
    } as unknown as OrderDto;
    setup('acknowledge', longOrder);
    const dialog = screen.getByRole('dialog');

    expect(screen.getByText('Soup 34')).toBeInTheDocument();
    expect(dialog.children.item(2)).toContainElement(
      screen.getByRole('button', { name: 'Approve with estimated 18 min' }),
    );
    expect(dialog.children.item(2)).toContainElement(screen.getByRole('button', { name: 'Reject order' }));
  });

  it('uses saved preparation instead of an implicit immediate estimate in direct flow', async () => {
    const estimatedOrder = { ...order, effectivePreparationMinutes: 18 } as OrderDto;
    const { onConfirm } = setup('direct', estimatedOrder);
    expect(screen.getByRole('button', { name: 'Confirm with estimated 18 min' })).toBeInTheDocument();
    expect(screen.getByText('Preparation estimate: 18 min')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm with estimated 18 min' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', 18));
  });

  it('uses a plain confirm action when no preparation snapshot is known and keeps presets', async () => {
    const { onConfirm } = setup('direct');
    expect(screen.getByRole('heading', { name: 'Confirm order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm order' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '30 min' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', 30));
  });

  it('rejects invalid custom minutes before calling the API', async () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom minutes' }), { target: { value: '0' } });
    const approveButtons = screen.getAllByRole('button', { name: 'Approve order' });
    fireEvent.click(approveButtons[0]);

    expect(await screen.findByText('Enter 1 to 600 minutes')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('requires a reason in a separate danger confirmation before cancelling', async () => {
    const { onReject } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reject order' }));
    expect(screen.getByRole('heading', { name: 'Reject this order?' })).toBeInTheDocument();
    const initialRejectButtons = screen.getAllByRole('button', { name: 'Reject order' });
    fireEvent.click(initialRejectButtons[initialRejectButtons.length - 1]);
    expect(await screen.findByText('Please provide a cancellation reason')).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Cancellation reason' }), {
      target: { value: 'Kitchen closed' },
    });
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject order' });
    fireEvent.click(rejectButtons[rejectButtons.length - 1]);
    await waitFor(() => expect(onReject).toHaveBeenCalledWith('order-id', 'Kitchen closed'));
  });
});
