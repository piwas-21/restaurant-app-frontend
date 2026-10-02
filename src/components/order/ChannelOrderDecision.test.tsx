import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChannelOrderDecision from './ChannelOrderDecision';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import { getChannelDecision, queueChannelDecision } from '@/services/channelDecisionService';
import type { ChannelDecisionDto } from '@/types/order/channelDecision';

jest.mock('@/services/channelDecisionService');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const id = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const pending: ChannelDecisionDto = {
  operationId,
  orderId: id,
  action: 'accept',
  state: 'Pending',
  createdAt: '2026-10-01T20:00:00Z',
  lastObservedAt: null,
};
const order = () => ({ ...marketplaceOrder(), id, version: 7 });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getChannelDecision).mockResolvedValue(null);
  jest.mocked(queueChannelDecision).mockResolvedValue(pending);
  jest.spyOn(crypto, 'randomUUID').mockReturnValue(operationId);
});
afterEach(() => jest.restoreAllMocks());

it('requires an explicit confirmation and nonempty reason after review', async () => {
  render(<ChannelOrderDecision order={order()} />);
  await screen.findByRole('button', { name: 'delivery_channels.decision_accept' });
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_accept' }));
  expect(queueChannelDecision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_submit' }));
  expect(screen.getByLabelText('delivery_channels.decision_reason')).toHaveAccessibleDescription(
    'delivery_channels.decision_reason_invalid',
  );
  expect(queueChannelDecision).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('delivery_channels.decision_reason'), {
    target: { value: 'Items and allergy instructions checked' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_submit' }));
  await screen.findByText('delivery_channels.decision_pending');
  expect(queueChannelDecision).toHaveBeenCalledWith(id, {
    operationId,
    action: 'accept',
    reason: 'Items and allergy instructions checked',
    expectedVersion: 7,
  });
  expect(screen.queryByText('delivery_channels.decision_succeeded')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'delivery_channels.decision_accept' })).not.toBeInTheDocument();
});
it('retries only the frozen decision after an uncertain response', async () => {
  jest
    .mocked(queueChannelDecision)
    .mockRejectedValueOnce(new TypeError('lost response'))
    .mockResolvedValueOnce({ ...pending, action: 'deny' });
  render(<ChannelOrderDecision order={order()} />);
  await screen.findByRole('button', { name: 'delivery_channels.decision_deny' });
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_deny' }));
  fireEvent.change(screen.getByLabelText('delivery_channels.decision_reason'), { target: { value: 'Test rejection' } });
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_submit' }));
  await screen.findByText('delivery_channels.decision_uncertain');
  expect(screen.queryByRole('button', { name: 'delivery_channels.decision_accept' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_retry' }));
  await screen.findByText('delivery_channels.decision_pending');
  expect(jest.mocked(queueChannelDecision).mock.calls[1]).toEqual(jest.mocked(queueChannelDecision).mock.calls[0]);
});
it('shows a terminal result without offering a competing decision', async () => {
  jest.mocked(getChannelDecision).mockResolvedValue({ ...pending, state: 'Succeeded' });
  const changed = jest.fn();
  render(<ChannelOrderDecision order={order()} onOrderChanged={changed} />);
  await screen.findByText('delivery_channels.decision_succeeded');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'delivery_channels.decision_accept' })).not.toBeInTheDocument();
});
it('holds decisions when the status lookup fails', async () => {
  jest.mocked(getChannelDecision).mockRejectedValue(new Error('offline'));
  render(<ChannelOrderDecision order={order()} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'delivery_channels.decision_accept' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'delivery_channels.decision_refresh' })).toBeEnabled();
});
it.each(['ACCEPTED', 'DENIED', 'CANCELED', 'FINISHED'])('never starts a decision for canonical %s', async (state) => {
  const value = order();
  value.externalOrder!.externalState = state;
  render(<ChannelOrderDecision order={value} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'delivery_channels.decision_refresh' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'delivery_channels.decision_accept' })).not.toBeInTheDocument();
});
it('renders nothing and makes no API request for ordinary orders', () => {
  const { container } = render(<ChannelOrderDecision order={{ ...order(), externalOrder: null }} />);
  expect(container).toBeEmptyDOMElement();
  expect(getChannelDecision).not.toHaveBeenCalled();
});

it('requires a refreshed order version after a definitive conflict', async () => {
  const { ApiError } = await import('@/utils/apiClient');
  jest.mocked(queueChannelDecision).mockRejectedValueOnce(new ApiError(409, ''));
  const changed = jest.fn();
  const { rerender } = render(<ChannelOrderDecision order={order()} onOrderChanged={changed} />);
  await screen.findByRole('button', { name: 'delivery_channels.decision_accept' });
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_accept' }));
  fireEvent.change(screen.getByLabelText('delivery_channels.decision_reason'), { target: { value: 'Checked' } });
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_submit' }));
  await screen.findByRole('alert');
  expect(changed).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'delivery_channels.decision_refresh' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'delivery_channels.decision_refresh' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'delivery_channels.decision_submit' })).not.toBeInTheDocument();
  expect(changed).toHaveBeenCalledTimes(2);
  rerender(<ChannelOrderDecision order={{ ...order(), version: 8 }} onOrderChanged={changed} />);
  expect(screen.getByRole('button', { name: 'delivery_channels.decision_submit' })).toBeEnabled();
});

it('surfaces the server explanation while withholding another decision', async () => {
  const { ApiError } = await import('@/utils/apiClient');
  jest.mocked(getChannelDecision).mockRejectedValue(new ApiError(403, 'Only a cashier or admin may decide.'));
  render(<ChannelOrderDecision order={order()} />);
  await screen.findByText('Only a cashier or admin may decide.');
  expect(screen.queryByRole('button', { name: 'delivery_channels.decision_accept' })).not.toBeInTheDocument();
});
