import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { OrderDto } from '@/types/order';
import CashierReadOnlyDestination from './CashierReadOnlyDestination';

const mockI18n = { language: 'en-US' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: mockI18n,
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.start !== undefined) return `${options.start}-${options.end}/${options.total}`;
      return key;
    },
  }),
}));
jest.mock('./CashierWorkspaceShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('./CashierTicketActions', () => ({ __esModule: true, default: () => null }));

const order = ({ id = 'one' }: { id?: string } = {}): OrderDto =>
  ({
    id,
    orderNumber: '1042',
    type: 'Takeaway',
    total: 18,
    totalPaid: 0,
    remainingAmount: 18,
    isFullyPaid: false,
    status: 'Preparing',
    paymentStatus: 'Pending',
    orderDate: '2026-03-09T12:00:00Z',
    items: [],
    payments: [],
    statusHistory: [],
  }) as unknown as OrderDto;

const baseProps = (overrides: Partial<ComponentProps<typeof CashierReadOnlyDestination>> = {}) => ({
  destination: 'orders' as const,
  description: 'description',
  orders: [order()],
  pagination: { totalCount: 1, page: 1, pageSize: 50, totalPages: 1 },
  queueState: 'ready' as const,
  isLoading: false,
  error: null,
  selectedOrderId: null,
  selectedOrder: null,
  selectedOrderLoading: false,
  selectedOrderError: null,
  searchQuery: '',
  statusFilter: 'all',
  paymentStatusFilter: 'all',
  orderTypeFilter: 'all',
  onSelectOrder: jest.fn(),
  onBack: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchSubmit: jest.fn(),
  onStatusFilterChange: jest.fn(),
  onPaymentStatusFilterChange: jest.fn(),
  onOrderTypeFilterChange: jest.fn(),
  onPageChange: jest.fn(),
  onRetry: jest.fn(),
  ...overrides,
});

describe('CashierReadOnlyDestination mobile focus', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
    });
  });

  it('moves focus into the ticket and restores it to the row on Back', async () => {
    const { rerender } = render(<CashierReadOnlyDestination {...baseProps()} />);
    const row = screen.getByRole('button', { name: /1042/ });
    const selected = order();
    rerender(<CashierReadOnlyDestination {...baseProps({ selectedOrderId: 'one', selectedOrder: selected })} />);

    const back = await screen.findByRole('button', { name: 'cashier.workspace.back_to_list' });
    await waitFor(() => expect(back).toHaveFocus());
    fireEvent.click(back);
    rerender(<CashierReadOnlyDestination {...baseProps()} />);
    await waitFor(() => expect(row).toHaveFocus());
  });

  it('passes the selected order visit to the collection action', () => {
    const onCollect = jest.fn();
    const selected = { ...order(), serviceSessionId: 'visit-1' } as OrderDto;
    render(
      <CashierReadOnlyDestination {...baseProps({ selectedOrderId: 'one', selectedOrder: selected, onCollect })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'cashier.collection.title' }));

    expect(onCollect).toHaveBeenCalledWith('one', 'visit-1');
  });
});
