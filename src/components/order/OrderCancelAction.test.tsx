import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { cancelOrder } from '@/services/orderService';
import type { OrderDto } from '@/types/order';
import OrderCancelAction from './OrderCancelAction';

jest.mock('@/services/orderService', () => ({ cancelOrder: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const order = {
  id: 'original-order',
  version: 7,
  status: 'Completed',
  permittedActions: [{ action: 'CancelOrder', allowed: true }],
} as OrderDto;

beforeEach(() => jest.clearAllMocks());

it('confirms a completed order with an optional empty reason and the reviewed version', async () => {
  jest.mocked(cancelOrder).mockResolvedValue({ ...order, status: 'Cancelled' });
  const changed = jest.fn();
  render(<OrderCancelAction order={order} onChanged={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'cancel_order' }));
  const modal = screen.getByRole('dialog');
  expect(within(modal).getByLabelText('staff_cancel_reason')).toHaveValue('');
  const confirm = within(modal).getByRole('button', { name: 'cancel_order' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(cancelOrder).toHaveBeenCalledTimes(1);
  expect(cancelOrder).toHaveBeenCalledWith('original-order', { cancellationReason: '', expectedVersion: 7 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps the reason and modal visible after a server refusal', async () => {
  jest.mocked(cancelOrder).mockRejectedValue(new ApiError(409, 'Refresh the changed order'));
  const changed = jest.fn();
  render(<OrderCancelAction order={order} onChanged={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'cancel_order' }));
  fireEvent.change(screen.getByLabelText('staff_cancel_reason'), { target: { value: 'Guest left' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel_order' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh the changed order');
  expect(screen.getByLabelText('staff_cancel_reason')).toHaveValue('Guest left');
  expect(changed).not.toHaveBeenCalled();
});

it('requires a fresh snapshot and an allowed server capability', () => {
  const view = render(<OrderCancelAction order={order} disabled onChanged={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'cancel_order' })).toBeDisabled();
  view.rerender(<OrderCancelAction order={{ ...order, permittedActions: [] }} onChanged={jest.fn()} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
