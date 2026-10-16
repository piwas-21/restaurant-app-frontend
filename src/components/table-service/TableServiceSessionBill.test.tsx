import { render, screen, within } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import TableServiceSessionBill from './TableServiceSessionBill';
import { makeOrder, makeOrderItem } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
    i18n: { language: 'en' },
  }),
}));

const session = {
  serviceSessionId: 'visit-1',
  tableNumber: 4,
  currency: 'EUR',
  outstanding: 10,
  bill: {
    serviceSessionId: 'visit-1',
    tableNumber: 4,
    currency: 'EUR',
    generatedAt: '2026-10-09T12:00:00Z',
    orders: [],
    orderCount: 0,
    subTotal: 30,
    tax: 0,
    discount: 0,
    tip: 0,
    paymentTip: 3.5,
    paymentFlowMode: 'CustomAmount',
    guestCount: 2,
    guestAmounts: [
      { guestNumber: 1, amount: 15, status: 'Captured' },
      { guestNumber: 2, amount: 15, status: 'Due' },
    ],
    total: 30,
    totalPaid: 15,
    remaining: 15,
  },
} as unknown as TableServiceSessionDto;

it('prints split flow, guest allocations, and gratuity as separate bill details', () => {
  render(<TableServiceSessionBill session={session} />);

  expect(document.getElementById('table-session-bill-print')).toBeInTheDocument();
  expect(screen.getByText(/cashier\.tables\.payment_flow_custom/)).toBeInTheDocument();
  expect(screen.getByText(/cashier\.tables\.split_guest_count:2/)).toBeInTheDocument();
  expect(screen.getByText(/cashier\.tables\.split_status_captured/)).toHaveTextContent('EUR 15.00');
  expect(screen.getByText(/cashier\.tables\.split_status_due/)).toHaveTextContent('EUR 15.00');
  const tipLabel = screen.getByText('cashier.tables.payment_tip_received');
  expect(tipLabel).toBeInTheDocument();
  expect(tipLabel.nextElementSibling?.textContent).toMatch(/EUR\s3\.50/);
  expect(screen.getByText('cashier.tables.tip_food_refund_notice')).toBeInTheDocument();
});

it('omits instructions at every depth from the combined bill while retaining items and charges', () => {
  const order = makeOrder([
    makeOrderItem({
      id: 'meal',
      productName: 'Meal',
      itemTotal: 20,
      specialInstructions: 'Root instruction',
      sideItems: [
        makeOrderItem({
          id: 'side',
          productName: 'Side',
          specialInstructions: 'Child instruction',
          sideItems: [makeOrderItem({ id: 'sauce', productName: 'Sauce', specialInstructions: 'Nested instruction' })],
        }),
      ],
    }),
  ]);
  render(<TableServiceSessionBill session={{ ...session, bill: { ...session.bill, orders: [order] } }} />);
  expect(screen.getByText('Meal')).toBeInTheDocument();
  expect(screen.getByText('Side')).toBeInTheDocument();
  expect(screen.getByText('Sauce')).toBeInTheDocument();
  expect(screen.queryByText('Root instruction')).not.toBeInTheDocument();
  expect(screen.queryByText('Child instruction')).not.toBeInTheDocument();
  expect(screen.queryByText('Nested instruction')).not.toBeInTheDocument();
  expect(screen.getAllByText(/EUR\s20\.00/)).toHaveLength(2);
});

it('disambiguates repeated daily order numbers by business date and uses the tenant timezone', () => {
  const order = {
    id: 'order-1',
    orderNumber: 'full-order-reference-1',
    dailyOrderNumber: 1,
    businessDate: '2026-10-14',
    businessTimeZoneId: 'Europe/Zurich',
    orderDate: '2026-10-14T12:30:00.000Z',
    status: 'Confirmed',
    paymentStatus: 'Pending',
    remainingAmount: 10,
    total: 10,
    currency: 'EUR',
    payments: [],
    items: [],
  };
  const nextDayOrder = {
    ...order,
    id: 'order-2',
    orderNumber: 'full-order-reference-2',
    businessDate: '2026-10-15',
    orderDate: '2026-10-15T12:45:00.000Z',
  };
  const crossDateSession = {
    ...session,
    bill: {
      ...session.bill,
      orders: [order, nextDayOrder],
    },
  } as unknown as TableServiceSessionDto;

  render(<TableServiceSessionBill session={crossDateSession} />);

  const rounds = screen.getAllByRole('article');
  expect(rounds).toHaveLength(2);
  expect(rounds[0]).toHaveTextContent('1');
  expect(within(rounds[0]).getByText('Oct 14, 2026')).toBeInTheDocument();
  expect(within(rounds[0]).getByText('02:30 PM')).toBeInTheDocument();
  expect(rounds[1]).toHaveTextContent('1');
  expect(within(rounds[1]).getByText('Oct 15, 2026')).toBeInTheDocument();
  expect(within(rounds[1]).getByText('02:45 PM')).toBeInTheDocument();
});
