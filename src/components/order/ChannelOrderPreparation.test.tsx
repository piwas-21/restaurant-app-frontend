import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChannelOrderPreparation from './ChannelOrderPreparation';
import { updateOrderStatus } from '@/services/order/orderCommands';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import { ApiError } from '@/utils/apiClient';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/order/orderCommands', () => ({ updateOrderStatus: jest.fn() }));
const update = jest.mocked(updateOrderStatus);
function accepted(): OrderDto {
  const order = marketplaceOrder();
  return {
    ...order,
    status: 'Confirmed',
    version: 7,
    isKitchenReleased: true,
    externalOrder: { ...order.externalOrder!, externalState: 'ACCEPTED' },
    permittedActions: [{ action: 'StartPreparing', allowed: true, requiresReason: false }],
  };
}
beforeEach(() => jest.clearAllMocks());

it.each(['held', 'missing permission', 'server denied', 'cancelled', 'local'])(
  'withholds preparation for %s orders',
  (state) => {
    const order = accepted();
    if (state === 'held') order.isKitchenReleased = false;
    if (state === 'missing permission') order.permittedActions = [];
    if (state === 'server denied') order.permittedActions![0].allowed = false;
    if (state === 'cancelled') order.externalOrder!.externalState = 'CANCELED';
    if (state === 'local') order.externalOrder = null;
    render(<ChannelOrderPreparation order={order} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  },
);
it('sends the frozen version once, waits for confirmed response and a fresh order before another action', async () => {
  const order = accepted();
  const refresh = jest.fn();
  let resolve!: (order: OrderDto) => void;
  update.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = render(<ChannelOrderPreparation order={order} onOrderChanged={refresh} />);
  fireEvent.click(screen.getByRole('button'));
  fireEvent.click(screen.getByRole('button'));
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(order.id, { newStatus: 'Preparing', expectedVersion: 7 });
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('button')).toBeDisabled();
  await act(async () => resolve({ ...order, status: 'Preparing', version: 8 }));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button')).toBeDisabled();
  const prepared: OrderDto = {
    ...order,
    status: 'Preparing',
    version: 8,
    permittedActions: [{ action: 'MarkReady', allowed: true, requiresReason: false }],
  };
  update.mockResolvedValue({ ...prepared, status: 'Ready', version: 9 });
  view.rerender(<ChannelOrderPreparation order={prepared} onOrderChanged={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'mark_as_ready_button' }));
  await waitFor(() => expect(update).toHaveBeenLastCalledWith(order.id, { newStatus: 'Ready', expectedVersion: 8 }));
});
it('shows the server refusal, refreshes after uncertainty and offers a translated fallback', async () => {
  update.mockRejectedValueOnce(new ApiError(409, 'The order changed.'));
  const refresh = jest.fn();
  render(<ChannelOrderPreparation order={accepted()} onOrderChanged={refresh} />);
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('The order changed.');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button')).toBeEnabled();
  update.mockRejectedValueOnce(new ApiError(504, ''));
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('delivery_channels.preparation_error'));
});
it('rejects another order or non-advancing response without announcing success', async () => {
  const order = accepted();
  const refresh = jest.fn();
  update.mockResolvedValue({ ...order, status: 'Preparing' });
  render(<ChannelOrderPreparation order={order} onOrderChanged={refresh} />);
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('delivery_channels.preparation_error');
  expect(screen.getByRole('button')).toBeEnabled();
});
it('ignores late responses after switching away and back to the same order', async () => {
  const order = accepted();
  const refresh = jest.fn();
  let resolve!: (order: OrderDto) => void;
  update.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = render(<ChannelOrderPreparation order={order} onOrderChanged={refresh} />);
  fireEvent.click(screen.getByRole('button'));
  view.rerender(<ChannelOrderPreparation order={{ ...order, id: 'another' }} onOrderChanged={refresh} />);
  view.rerender(<ChannelOrderPreparation order={order} onOrderChanged={refresh} />);
  await act(async () => resolve({ ...order, status: 'Preparing', version: 8 }));
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toBeEnabled();
});
