import { render, screen } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import TableServiceSessionBill from './TableServiceSessionBill';

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
