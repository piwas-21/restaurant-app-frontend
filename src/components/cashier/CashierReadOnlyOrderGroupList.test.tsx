import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CashierReadOnlyOrderGroupList from './CashierReadOnlyOrderGroupList';
import type { CashierOrderGroupDto } from '@/types/cashier';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count !== undefined ? `${key} ${options.count}` : key,
  }),
}));

const order = (id: string, orderNumber: string): OrderDto =>
  ({
    id,
    orderNumber,
    type: 'DineIn',
    total: 20,
    totalPaid: 0,
    remainingAmount: 20,
    status: 'Pending',
    paymentStatus: 'Pending',
    orderDate: '2026-10-09T11:00:00Z',
    serviceSessionId: 'session-5',
    tableNumber: 5,
    tableLabel: 'Table 5',
    items: [],
    payments: [],
  }) as unknown as OrderDto;

describe('CashierReadOnlyOrderGroupList', () => {
  it('renders one row for the visit and keeps later rounds out of the list', () => {
    const onSelectOrder = jest.fn();
    const group: CashierOrderGroupDto = {
      groupKey: 'visit:session-5',
      serviceSessionId: 'session-5',
      tableNumber: 5,
      releasedAt: '2026-10-08T12:00:00Z',
      isArchivedFromTable: false,
      orders: [order('order-1', 'O-101'), order('order-2', 'O-102')],
    };

    render(<CashierReadOnlyOrderGroupList groups={[group]} selectedOrderId={null} onSelectOrder={onSelectOrder} />);

    expect(screen.getByText('O-101')).toBeInTheDocument();
    expect(screen.getByText('staff_order_updated')).toBeInTheDocument();
    expect(screen.queryByText('O-102')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelectOrder).toHaveBeenCalledWith('order-1');
  });

  it('keeps standalone orders separate and headed by their original order numbers', () => {
    const groups: CashierOrderGroupDto[] = [
      {
        groupKey: 'order:one',
        serviceSessionId: null,
        tableNumber: 5,
        releasedAt: null,
        isArchivedFromTable: true,
        orders: [order('one', 'O-201')],
      },
      {
        groupKey: 'order:two',
        serviceSessionId: null,
        tableNumber: 5,
        releasedAt: null,
        isArchivedFromTable: false,
        orders: [order('two', 'O-202')],
      },
    ];

    render(<CashierReadOnlyOrderGroupList groups={groups} selectedOrderId={null} onSelectOrder={jest.fn()} />);

    expect(screen.getByText('O-201')).toBeInTheDocument();
    expect(screen.getByText('O-202')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Table 5' })).not.toBeInTheDocument();
  });
});

it('shows a partly paid visit when a paid original has a new unpaid round', () => {
  const first = {
    ...order('original', 'FIRST'),
    totalPaid: 20,
    remainingAmount: 0,
    paymentStatus: 'Completed',
    status: 'Completed',
  };
  const later = order('later', 'LATER');
  render(
    <CashierReadOnlyOrderGroupList
      groups={[
        {
          groupKey: 'visit:session-5',
          serviceSessionId: 'session-5',
          tableNumber: 5,
          releasedAt: null,
          isArchivedFromTable: false,
          orders: [first, later],
        },
      ]}
      selectedOrderId="later"
      onSelectOrder={jest.fn()}
    />,
  );
  expect(screen.getByText('payment_status_partially_paid')).toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  expect(screen.queryByText('LATER')).not.toBeInTheDocument();
});

it('labels a consolidated credit as overpaid', () => {
  const first = { ...order('original', 'FIRST'), totalPaid: 30, remainingAmount: -10, paymentStatus: 'Overpaid' };
  const later = { ...order('later', 'LATER'), total: 5, remainingAmount: 5 };
  render(
    <CashierReadOnlyOrderGroupList
      groups={[
        {
          groupKey: 'visit:session-5',
          serviceSessionId: 'session-5',
          tableNumber: 5,
          releasedAt: null,
          isArchivedFromTable: false,
          orders: [first, later],
        },
      ]}
      selectedOrderId={null}
      onSelectOrder={jest.fn()}
    />,
  );
  expect(screen.getByText('payment_status_overpaid')).toBeInTheDocument();
});

it('marks an update without new items while preserving the first order row', () => {
  render(
    <CashierReadOnlyOrderGroupList
      groups={[
        {
          groupKey: 'order:original',
          serviceSessionId: null,
          tableNumber: null,
          releasedAt: null,
          isArchivedFromTable: false,
          hasUpdates: true,
          orders: [order('original', 'FIRST')],
        },
      ]}
      selectedOrderId={null}
      onSelectOrder={jest.fn()}
    />,
  );
  expect(screen.getByText('staff_order_updated')).toBeInTheDocument();
  expect(screen.getByText('FIRST')).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

it.each(['OutForDelivery', 'Delivered'])(
  'shows a later delivery round as %s after the original completes',
  (status) => {
    render(
      <CashierReadOnlyOrderGroupList
        groups={[
          {
            groupKey: 'order:original',
            serviceSessionId: null,
            tableNumber: null,
            releasedAt: null,
            isArchivedFromTable: false,
            orders: [
              { ...order('original', 'FIRST'), type: 'Delivery', status: 'Completed' },
              { ...order('later', 'LATER'), type: 'Delivery', status },
            ],
          },
        ]}
        selectedOrderId={null}
        onSelectOrder={jest.fn()}
      />,
    );
    expect(
      screen.getByText(status === 'OutForDelivery' ? 'order_status_in_transit' : 'order_status_delivered'),
    ).toBeInTheDocument();
    expect(screen.queryByText('order_status_completed')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  },
);
