import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import CashierReadOnlyQueuePanel from './CashierReadOnlyQueuePanel';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.start !== undefined) return `${options.start}-${options.end}/${options.total}`;
      if (options?.order !== undefined) return `Open ${options.order}`;
      return key;
    },
  }),
}));

const order = (id: string): OrderDto =>
  ({
    id,
    orderNumber: '1042',
    type: 'Takeaway',
    total: 18,
    totalPaid: 0,
    remainingAmount: 18,
    status: 'Preparing',
    paymentStatus: 'Pending',
    orderDate: '2026-03-09T12:00:00Z',
    items: [],
    payments: [],
  }) as unknown as OrderDto;

const props = (overrides: Partial<ComponentProps<typeof CashierReadOnlyQueuePanel>> = {}) => ({
  destination: 'orders' as const,
  orders: [order('one')],
  pagination: { totalCount: 1, page: 1, pageSize: 50, totalPages: 1 },
  queueState: 'ready' as const,
  isLoading: false,
  error: null,
  selectedOrderId: null,
  searchQuery: '',
  statusFilter: 'all',
  paymentStatusFilter: 'all',
  orderTypeFilter: 'all',
  onSelectOrder: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchSubmit: jest.fn(),
  onStatusFilterChange: jest.fn(),
  onPaymentStatusFilterChange: jest.fn(),
  onOrderTypeFilterChange: jest.fn(),
  onPageChange: jest.fn(),
  onRetry: jest.fn(),
  ...overrides,
});

describe('CashierReadOnlyQueuePanel', () => {
  it('uses native row buttons and sends search and filter events to the server owner', () => {
    const onSelectOrder = jest.fn();
    const onSearchSubmit = jest.fn();
    const onStatusFilterChange = jest.fn();
    render(<CashierReadOnlyQueuePanel {...props({ onSelectOrder, onSearchSubmit, onStatusFilterChange })} />);

    fireEvent.click(screen.getByRole('button', { name: /1042/ }));
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.change(screen.getByLabelText('cashier.workspace.status_filter'), { target: { value: 'Ready' } });

    expect(onSelectOrder).toHaveBeenCalledWith('one');
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
    expect(onStatusFilterChange).toHaveBeenCalledWith('Ready');
  });

  it('names the visible queue context and offers every canonical status', () => {
    render(<CashierReadOnlyQueuePanel {...props()} />);

    const row = screen.getByRole('button', { name: /1042/ });
    expect(row).toHaveAccessibleName(expect.stringContaining('cashier.workspace.channel_takeaway'));
    expect(row).toHaveAccessibleName(expect.stringContaining('cashier.workspace.due_value'));
    const statusSelect = screen.getByLabelText('cashier.workspace.status_filter') as HTMLSelectElement;
    expect([...statusSelect.options].map((option) => option.value)).toEqual([
      'all',
      'Pending',
      'PendingApproval',
      'Confirmed',
      'Preparing',
      'In Progress',
      'Ready',
      'OutForDelivery',
      'InTransit',
      'Delivered',
      'Completed',
      'Cancelled',
      'Refunded',
    ]);
  });

  it('keeps the last snapshot visible while stale and distinguishes unavailable', () => {
    const { rerender } = render(<CashierReadOnlyQueuePanel {...props({ queueState: 'stale' })} />);
    expect(screen.getByText('cashier.workspace.queue_stale')).toBeInTheDocument();
    rerender(<CashierReadOnlyQueuePanel {...props({ queueState: 'unavailable', orders: [] })} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('cashier.workspace.queue_unavailable')).toBeInTheDocument();
  });
});
