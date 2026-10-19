import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CashierOrderStatusActions from './CashierOrderStatusActions';
import { updateOrderStatus } from '@/services/cashierService';
import { ApiError } from '@/utils/apiClient';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/cashierService', () => ({ updateOrderStatus: jest.fn() }));
const update = jest.mocked(updateOrderStatus);
const order = {
  id: 'o1',
  version: 7,
  status: 'Ready',
  permittedActions: [{ action: 'HandOver', targetStatus: 'Completed', allowed: true, requiresReason: false }],
} as OrderDto;
beforeEach(() => jest.clearAllMocks());

it('explains missing kitchen confirmation and completes only after explicit approval with the same version', async () => {
  update
    .mockRejectedValueOnce(new ApiError(200, 'Operation failed', undefined, 'KitchenWorkUnresolved'))
    .mockResolvedValueOnce({ ...order, status: 'Completed' });
  const changed = jest.fn();
  render(<CashierOrderStatusActions order={order} isFresh approvalRequired={false} onChanged={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.set_status' }));
  expect(await screen.findByRole('dialog', { name: 'staffCompletion.title' })).toBeInTheDocument();
  expect(screen.getByText('staffCompletion.work')).toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'staffCompletion.confirm' }));
  await waitFor(() => expect(update).toHaveBeenLastCalledWith('o1', 'Completed', 7, true));
  expect(changed).toHaveBeenCalledTimes(1);
});

it('does not offer work acknowledgement for stale snapshots or payment failures', async () => {
  update.mockRejectedValueOnce(new ApiError(409, 'Refresh the order', undefined, 'OrderVersionConflict'));
  render(<CashierOrderStatusActions order={order} isFresh approvalRequired={false} onChanged={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.set_status' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
