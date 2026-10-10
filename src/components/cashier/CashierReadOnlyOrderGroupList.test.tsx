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
  it('renders a visit summary with its separate order numbers and routes collection by session', () => {
    const onCollectSession = jest.fn();
    const group: CashierOrderGroupDto = {
      groupKey: 'visit:session-5',
      serviceSessionId: 'session-5',
      tableNumber: 5,
      releasedAt: '2026-10-08T12:00:00Z',
      isArchivedFromTable: false,
      orders: [order('order-1', 'O-101'), order('order-2', 'O-102')],
    };

    render(
      <CashierReadOnlyOrderGroupList
        groups={[group]}
        selectedOrderId={null}
        onSelectOrder={jest.fn()}
        onCollectSession={onCollectSession}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Table 5' })).toBeInTheDocument();
    expect(screen.getByText('cashier.workspace.released_visit')).toBeInTheDocument();
    expect(screen.getByText('O-101')).toBeInTheDocument();
    expect(screen.getByText('O-102')).toBeInTheDocument();
    expect(screen.getByText('cashier.workspace.group_rounds 2')).toBeInTheDocument();
    expect(screen.getByText('cashier.workspace.group_pending 2')).toBeInTheDocument();
    expect(screen.getByText('cashier.workspace.group_with_balance 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.collect_for_visit' }));
    expect(onCollectSession).toHaveBeenCalledWith('session-5');
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
    expect(screen.getByText('cashier.workspace.prior_table_order')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Table 5' })).not.toBeInTheDocument();
  });
});
