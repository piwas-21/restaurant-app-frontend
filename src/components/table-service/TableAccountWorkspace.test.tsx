import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import TableAccountWorkspace from './TableAccountWorkspace';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template =
        key === 'cashier.tables.account_order'
          ? 'Order {{order}}'
          : key === 'cashier.tables.account_refunded_amount'
            ? 'Refunded {{amount}}'
            : key;
      return options
        ? template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options[name] ?? `{{${name}}}`))
        : template;
    },
    i18n: { language: 'en', dir: () => 'ltr' },
  }),
}));

const session = {
  serviceSessionId: 'visit-1',
  tableNumber: 9,
  tableLabel: 'T9',
  currency: 'CHF',
  status: 'Open',
  version: 2,
  accountRevision: 5,
  openedAt: '2026-10-02T10:00:00Z',
  roundCount: 1,
  ageMinutes: 20,
  outstanding: 20,
  bill: {
    tableNumber: 9,
    serviceSessionId: 'visit-1',
    serviceSessionVersion: 2,
    accountRevision: 5,
    currency: 'CHF',
    generatedAt: '2026-10-02T10:20:00Z',
    accountItems: [
      {
        orderId: 'order-1',
        orderNumber: 'A-001',
        orderItemId: 'item-1',
        itemSnapshot: {
          id: 'item-1',
          productId: 'burger-id',
          productName: 'Burger',
          quantity: 2,
          unitPrice: 10,
          itemTotal: 20,
        },
        unitCount: 2,
      },
    ],
    rounds: [],
    orders: [
      {
        id: 'order-1',
        orderNumber: 'A-001',
        orderDate: '2026-10-02T10:05:00Z',
        status: 'Ready',
        total: 20,
        totalPaid: 5,
        remainingAmount: 15,
        currency: 'CHF',
        items: [],
        payments: [{ id: 'payment-1', paymentMethod: 'Cash', amount: 5, status: 'Completed' }],
        statusHistory: [{ id: 'status-1', orderId: 'order-1', status: 'Ready', changedAt: '2026-10-02T10:12:00Z' }],
      },
    ],
    orderCount: 1,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 5,
    remaining: 15,
  },
} as unknown as TableServiceSessionDto;

const refundedOrder = {
  ...session.bill.orders[0],
  status: 'Refunded',
  paymentStatus: 'Refunded',
  total: 10,
  totalPaid: 10,
  remainingAmount: 0,
  payments: [{ id: 'refund-1', paymentMethod: 'Cash', amount: 10, status: 'Refunded', refundedAmount: 10 }],
};

const mixedRefundSession = {
  ...session,
  outstanding: 30,
  eligibleOutstanding: 20,
  bill: {
    ...session.bill,
    remaining: 30,
    eligibleOutstanding: 20,
    orders: [
      refundedOrder,
      {
        ...session.bill.orders[0],
        id: 'order-2',
        orderNumber: 'A-002',
        status: 'Ready',
        total: 20,
        totalPaid: 0,
        remainingAmount: 20,
        payments: [],
      },
    ],
  },
} as unknown as TableServiceSessionDto;

describe('TableAccountWorkspace', () => {
  it('starts on root account items and displays the backend unit count', () => {
    render(<TableAccountWorkspace session={session} timeZone="Europe/Amsterdam" />);

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('2×')).toBeInTheDocument();
    expect(within(panel).getByText('Burger')).toBeInTheDocument();
    expect(within(panel).getAllByText('Order A-001')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'cashier.tables.account_items' })).toHaveAttribute('aria-selected', 'true');
  });

  it('uses eligible outstanding when refunded rounds remain in the raw bill balance', () => {
    render(<TableAccountWorkspace session={mixedRefundSession} />);

    const balance = screen.getByLabelText('cashier.tables.account_balance');
    expect(balance).toHaveTextContent(/CHF\s*20\.00/);
    expect(balance).not.toHaveTextContent(/CHF\s*30\.00/);
  });

  it('keeps order refund state beside snapshot items and shows the recorded bill breakdown', () => {
    const discounted = {
      ...session,
      bill: {
        ...session.bill,
        subTotal: 20,
        discount: 2,
        total: 18,
        remaining: 13,
        orders: [
          {
            ...session.bill.orders[0],
            subTotal: 20,
            discount: 2,
            total: 18,
            customerDiscountAmount: 1,
            fidelityPointsDiscount: 0.5,
          },
        ],
      },
    } as unknown as TableServiceSessionDto;
    render(<TableAccountWorkspace session={discounted} />);

    expect(screen.getByText('cashier.tables.account_item_snapshot_note')).toBeInTheDocument();
    expect(screen.getByText('cashier.tables.account_bill_totals')).toBeInTheDocument();
    expect(screen.getAllByText('subtotal')).toHaveLength(2);
    expect(screen.getAllByText('discount')).toHaveLength(2);
    fireEvent.click(screen.getByText('Order A-001', { selector: 'summary span' }));
    expect(screen.getByText('customer_discount')).toBeInTheDocument();
    expect(screen.getByText('server.points_discount')).toBeInTheDocument();
    expect(screen.getByText('delivery_fee')).toBeInTheDocument();
    expect(screen.getAllByText(/CHF\s*18\.00/)).not.toHaveLength(0);
    expect(screen.getAllByText(/CHF\s*20\.00/)).not.toHaveLength(0);
  });

  it('marks refunded root rows by their order settlement status', () => {
    render(<TableAccountWorkspace session={mixedRefundSession} />);

    expect(screen.getByText('cashier.tables.account_order_refunded')).toBeInTheDocument();
  });

  it('keeps one refunded tender partial when another captured tender remains', () => {
    const splitTender = {
      ...session,
      bill: {
        ...session.bill,
        orders: [
          {
            ...session.bill.orders[0],
            status: 'Completed',
            paymentStatus: 'PartiallyPaid',
            total: 100,
            totalPaid: 100,
            remainingAmount: 0,
            payments: [
              { id: 'cash-1', paymentMethod: 'Cash', amount: 50, status: 'Refunded', refundedAmount: 50 },
              { id: 'cash-2', paymentMethod: 'Cash', amount: 50, status: 'Completed' },
            ],
          },
        ],
      },
    } as unknown as TableServiceSessionDto;
    render(<TableAccountWorkspace session={splitTender} />);

    expect(screen.getByText('cashier.tables.account_order_partially_refunded')).toBeInTheDocument();
    expect(screen.queryByText('cashier.tables.account_order_refunded')).not.toBeInTheDocument();
  });

  it('shows recorded payments by order and states that unit allocation is not available', () => {
    render(<TableAccountWorkspace session={session} />);

    fireEvent.click(screen.getByRole('tab', { name: 'cashier.tables.account_payments' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('cashier.tables.account_payment_allocation_unavailable')).toBeInTheDocument();
    expect(within(panel).getByText('A-001')).toBeInTheDocument();
    expect(within(panel).getByText('cashier.workspace.method_cash')).toBeInTheDocument();
    expect(within(panel).queryByText('Burger')).not.toBeInTheDocument();
  });

  it('shows persisted refund status and amount separately from the original payment', () => {
    const partiallyRefunded = {
      ...session,
      bill: {
        ...session.bill,
        orders: [
          {
            ...session.bill.orders[0],
            payments: [
              {
                id: 'payment-1',
                paymentMethod: 'Cash',
                amount: 10,
                status: 'PartiallyRefunded',
                refundedAmount: 3,
              },
            ],
          },
        ],
      },
    } as unknown as TableServiceSessionDto;
    render(<TableAccountWorkspace session={partiallyRefunded} />);
    fireEvent.click(screen.getByRole('tab', { name: 'cashier.tables.account_payments' }));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('cashier.workspace.record_partially_refunded')).toBeInTheDocument();
    expect(within(panel).getByText(/Refunded CHF/)).toHaveTextContent(/3\.00/);
    expect(within(panel).getByText(/CHF\s*10\.00/)).toBeInTheDocument();
  });

  it('supports arrow-key movement between tabs', () => {
    render(<TableAccountWorkspace session={session} />);
    const itemsTab = screen.getByRole('tab', { name: 'cashier.tables.account_items' });

    fireEvent.keyDown(itemsTab, { key: 'ArrowRight' });

    const paymentsTab = screen.getByRole('tab', { name: 'cashier.tables.account_payments' });
    expect(paymentsTab).toHaveAttribute('aria-selected', 'true');
    expect(paymentsTab).toHaveFocus();
  });

  it('builds activity from visit and order timestamps plus persisted status history', () => {
    render(<TableAccountWorkspace session={session} timeZone="Europe/Amsterdam" />);

    fireEvent.click(screen.getByRole('tab', { name: 'cashier.tables.account_activity' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('cashier.tables.account_visit_opened')).toBeInTheDocument();
    expect(within(panel).getByText('cashier.tables.account_order_recorded')).toBeInTheDocument();
    expect(within(panel).getByText('cashier.tables.account_order_status')).toBeInTheDocument();
    expect(within(panel).getAllByText('A-001')).toHaveLength(2);
  });

  it('prefers bounded account activity and identifies when earlier events are omitted', () => {
    const projected = {
      ...session,
      bill: {
        ...session.bill,
        orders: [session.bill.orders[0]],
        accountActivity: [
          {
            id: 'placed-cancelled',
            orderId: 'cancelled-order',
            orderNumber: 'A-002',
            kind: 'OrderPlaced',
            status: 'Cancelled',
            occurredAt: '2026-10-02T10:15:00Z',
          },
          {
            id: 'status-cancelled',
            orderId: 'cancelled-order',
            orderNumber: 'A-002',
            kind: 'StatusChanged',
            status: 'Cancelled',
            occurredAt: '2026-10-02T10:16:00Z',
          },
        ],
        hasMoreAccountActivity: true,
      },
    } as unknown as TableServiceSessionDto;
    render(<TableAccountWorkspace session={projected} />);

    fireEvent.click(screen.getByRole('tab', { name: 'cashier.tables.account_activity' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('cashier.tables.account_activity_has_more')).toBeInTheDocument();
    expect(within(panel).getAllByText('A-002')).toHaveLength(2);
    expect(within(panel).queryByText('A-001')).not.toBeInTheDocument();
  });

  it('fails closed on a missing account projection rather than reconstructing unit identities', () => {
    const legacy = { ...session, bill: { ...session.bill, accountItems: undefined } } as TableServiceSessionDto;
    render(<TableAccountWorkspace session={legacy} />);

    expect(screen.getByText('cashier.tables.account_items_unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Burger')).not.toBeInTheDocument();
  });
});
