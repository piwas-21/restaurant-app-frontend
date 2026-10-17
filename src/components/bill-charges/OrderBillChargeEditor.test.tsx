import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderBillChargeEditor from './OrderBillChargeEditor';
import OrderBillChargeAction from './OrderBillChargeAction';
import { addOrderBillCharges } from '@/services/billChargeService';
import { makeOrder } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('@/components/AuthContext', () => ({
  useOptionalAuth: () => ({ user: { userId: 'staff-design-test', role: 'Server' } }),
}));
jest.mock('@/hooks/useBillChargeConfiguration', () => ({
  useBillChargeConfiguration: () => ({
    configuration: {
      currency: 'CHF',
      rules: [
        {
          key: 'service_fee',
          label: 'Service fee',
          enabled: true,
          defaultAmount: 0,
          allowCustomAmount: true,
          roles: ['Server'],
          orderTypes: ['DineIn'],
        },
      ],
    },
    failed: false,
    loading: false,
  }),
}));
jest.mock('@/services/billChargeService', () => ({ addOrderBillCharges: jest.fn() }));
const order = { ...makeOrder([]), id: '11111111-1111-4111-8111-111111111111', version: 1, currency: 'CHF' };

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});
it('blocks collection while a zero, invalid or positive draft is selected without blocking fee editing', async () => {
  const draft = jest.fn();
  const refresh = jest.fn();
  render(<OrderBillChargeEditor order={order} disabled={false} onUpdated={refresh} onDraftChange={draft} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Service fee' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Service fee' }));
  expect(draft).toHaveBeenLastCalledWith(true);
  const input = screen.getByRole('textbox', { name: 'Service fee (CHF)' });
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: '3.50' } });
  expect(input).toBeEnabled();
  fireEvent.change(input, { target: { value: '-1' } });
  expect(screen.getByRole('button', { name: 'billCharges.addAmount' })).toBeDisabled();
  expect(addOrderBillCharges).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'billCharges.removeNamed' }));
  expect(draft).toHaveBeenLastCalledWith(false);
});

it('saves one positive fee through the existing idempotent API and releases the draft lock after refresh', async () => {
  jest.mocked(addOrderBillCharges).mockResolvedValue(order);
  const draft = jest.fn();
  const refresh = jest.fn();
  render(<OrderBillChargeEditor order={order} disabled={false} onUpdated={refresh} onDraftChange={draft} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Service fee' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Service fee (CHF)' }), { target: { value: '3,50' } });
  fireEvent.click(screen.getByRole('button', { name: 'billCharges.addAmount' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(addOrderBillCharges).toHaveBeenCalledWith(order.id, 1, expect.any(String), [
    { key: 'service_fee', amount: 3.5 },
  ]);
  expect(draft).toHaveBeenLastCalledWith(false);
  expect(sessionStorage.length).toBe(0);
});

it('keeps a saved pending charge recoverable after another actor cancels the order', async () => {
  const pending = {
    orderId: order.id,
    expectedVersion: 1,
    operationId: '22222222-2222-4222-8222-222222222222',
    charges: [{ key: 'service_fee', amount: 3.5 }],
  };
  sessionStorage.setItem(`staff.bill-charge:staff-design-test:${order.id}`, JSON.stringify(pending));
  jest.mocked(addOrderBillCharges).mockResolvedValue(order);
  const lock = jest.fn();
  render(
    <OrderBillChargeAction
      order={{ ...order, status: 'Cancelled', version: 4 }}
      disabled={false}
      onUpdated={jest.fn()}
      onBusyChange={lock}
    />,
  );
  const retry = await screen.findByRole('button', { name: 'billCharges.checkSave' });
  expect(lock).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole('textbox', { name: 'Service fee (CHF)' })).not.toBeInTheDocument();
  fireEvent.click(retry);
  await waitFor(() =>
    expect(addOrderBillCharges).toHaveBeenCalledWith(order.id, 1, pending.operationId, pending.charges),
  );
});
