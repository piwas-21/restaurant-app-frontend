import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import CashierConfirmModal from './CashierConfirmModal';

const labels: Record<string, string> = {
  'cashier.approve_order_title': 'Approve order',
  'cashier.confirm_order_title': 'Confirm order',
  'cashier.confirm_now': 'Confirm now',
  'cashier.confirm_with_preparation': 'Confirm with preparation time',
  'cashier.confirm_custom_minutes_invalid': 'Enter 1 to 600 minutes',
  'cashier.cancel_order_confirm_title': 'Cancel this order?',
  'cashier.workspace.channel_takeaway': 'Takeaway',
  'cashier.workspace.guest': 'Guest',
  'cashier.workspace.order_total': 'Total',
  order_number: 'Order number',
  type: 'Type',
  customer: 'Customer',
  phone: 'Phone',
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
    t: (key: string, values?: Record<string, number>) =>
      key === 'cashier.confirm_preset_minutes' ? `${values?.minutes} min` : (labels[key] ?? key),
  }),
}));

const order = {
  id: 'order-id',
  orderNumber: 'ORD-42',
  customerName: 'Ada',
  status: 'Pending',
  type: 'Takeaway',
  total: 31.5,
  items: [],
  payments: [],
  statusHistory: [],
} as unknown as OrderDto;

const setup = (flow: 'direct' | 'acknowledge' = 'acknowledge') => {
  const onClose = jest.fn();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onReject = jest.fn().mockResolvedValue(undefined);
  render(
    <CashierConfirmModal
      order={order}
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
  it('uses approve wording for acknowledge flow and confirms immediately with zero minutes', async () => {
    const { onClose, onConfirm } = setup();
    expect(screen.getByRole('heading', { name: 'Approve order' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm now' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', 0));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps legacy confirm wording and preparation presets for direct flow', async () => {
    const { onConfirm } = setup('direct');
    expect(screen.getByRole('heading', { name: 'Confirm order' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '30 min' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('order-id', 30));
  });

  it('rejects invalid custom minutes before calling the API', async () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom minutes' }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Enter 1 to 600 minutes')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('requires a reason in a separate danger confirmation before cancelling', async () => {
    const { onReject } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(screen.getByRole('heading', { name: 'Cancel this order?' })).toBeInTheDocument();
    const initialCancelButtons = screen.getAllByRole('button', { name: 'Cancel order' });
    fireEvent.click(initialCancelButtons[initialCancelButtons.length - 1]);
    expect(await screen.findByText('Please provide a cancellation reason')).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Cancellation reason' }), {
      target: { value: 'Kitchen closed' },
    });
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel order' });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);
    await waitFor(() => expect(onReject).toHaveBeenCalledWith('order-id', 'Kitchen closed'));
  });
});
