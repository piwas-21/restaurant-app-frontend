import { render, screen, waitFor } from '@testing-library/react';
import { makeOrder, makeOrderItem } from '@/utils/__fixtures__/bundleOrderFixture';
import { getCurrentStaffTicket } from '@/services/currentStaffTicketService';
import CashierReadOnlyTicket from './CashierReadOnlyTicket';
import CashierReadOnlyOrderList from './CashierReadOnlyOrderList';

jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/services/currentStaffTicketService', () => ({ getCurrentStaffTicket: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'cashier.workspace.table_value' ? `Table ${values?.table}` : key,
  }),
}));

it('shows the current complete ticket and totals without opening amendment history', async () => {
  const original = {
    ...makeOrder([makeOrderItem({ id: 'original', productName: 'Kebab', itemTotal: 13 })]),
    type: 'Takeaway',
    tableNumber: null,
    subTotal: 13,
    total: 13,
    remainingAmount: 13,
    currency: 'EUR',
  };
  const extra = {
    ...original,
    id: 'extra',
    items: [makeOrderItem({ id: 'drink', productName: 'Ayran', itemTotal: 1.5 })],
    subTotal: 1.5,
    total: 1.5,
    remainingAmount: 1.5,
  };
  jest.mocked(getCurrentStaffTicket).mockResolvedValue([original, extra]);
  render(<CashierReadOnlyTicket order={original} historyOrders={[original, extra]} />);
  await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());
  expect(screen.getByText('Kebab')).toBeVisible();
  expect(screen.getByText('Ayran')).toBeVisible();
  expect(screen.getByText('cashier.workspace.order_total').parentElement).toHaveTextContent('EUR 14.50');
  expect(screen.getByText('cashier.workspace.amount_due').parentElement).toHaveTextContent('EUR 14.50');
  expect(screen.queryByText('cashier.workspace.table')).not.toBeInTheDocument();
});

it('omits the phantom table in list rows and retains real dine-in labels', () => {
  const takeaway = { ...makeOrder([]), type: 'Takeaway', tableNumber: null };
  const { rerender } = render(
    <CashierReadOnlyOrderList orders={[takeaway]} selectedOrderId={null} onSelectOrder={jest.fn()} />,
  );
  expect(screen.queryByText(/^Table /)).not.toBeInTheDocument();
  rerender(
    <CashierReadOnlyOrderList
      orders={[{ ...takeaway, type: 'DineIn', tableLabel: '11a' }]}
      selectedOrderId={null}
      onSelectOrder={jest.fn()}
    />,
  );
  expect(screen.getByText('Table 11a')).toBeVisible();
});
