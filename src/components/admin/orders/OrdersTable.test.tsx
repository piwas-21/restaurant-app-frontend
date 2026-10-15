import { render, screen, within } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import { OrdersTable } from './OrdersTable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/hooks/useOrderHelpers', () => ({
  useOrderHelpers: () => ({
    formatPrice: (value: number) => `EUR ${value}`,
    formatDate: (value: string) => `legacy ${value}`,
    getOrderTypeIcon: () => null,
    getOrderTypeLabel: (value: string) => value,
    getStatusLabel: (value: string) => value,
    getPaymentStatusLabel: (value: string) => value,
  }),
}));

function buildOrder(id: string, businessDate: string, orderDate: string): OrderDto {
  return {
    id,
    orderNumber: `full-${id}`,
    dailyOrderNumber: 1,
    businessDate,
    businessTimeZoneId: 'Europe/Zurich',
    orderDate,
    type: 'Takeaway',
    isFocusOrder: false,
    customerName: 'Guest',
    customerEmail: '',
    status: 'Confirmed',
    paymentStatus: 'Pending',
    total: 10,
  } as unknown as OrderDto;
}

it('keeps same-number admin orders distinct by venue business date and time', () => {
  const first = buildOrder('first', '2026-10-14', '2026-10-14T12:30:00.000Z');
  const second = buildOrder('second', '2026-10-15', '2026-10-15T12:45:00.000Z');

  render(
    <OrdersTable
      orders={[first, second]}
      selectedOrderIds={new Set()}
      onToggleSelection={jest.fn()}
      onToggleSelectAll={jest.fn()}
      onViewDetails={jest.fn()}
      onUpdateStatus={jest.fn()}
      onToggleFocus={jest.fn()}
      onDeleteOrder={jest.fn()}
    />,
  );

  const rows = screen.getAllByRole('row');
  expect(rows).toHaveLength(3);
  expect(within(rows[1]).getByText('1')).toBeInTheDocument();
  expect(within(rows[1]).getByText('Oct 14, 2026')).toBeInTheDocument();
  expect(within(rows[1]).getByText('02:30 PM')).toBeInTheDocument();
  expect(within(rows[2]).getByText('1')).toBeInTheDocument();
  expect(within(rows[2]).getByText('Oct 15, 2026')).toBeInTheDocument();
  expect(within(rows[2]).getByText('02:45 PM')).toBeInTheDocument();
});

it('keeps the existing complete timestamp for legacy orders without a business date', () => {
  const legacy = buildOrder('legacy', '', '2026-10-14T12:30:00.000Z');
  delete legacy.businessDate;

  render(
    <OrdersTable
      orders={[legacy]}
      selectedOrderIds={new Set()}
      onToggleSelection={jest.fn()}
      onToggleSelectAll={jest.fn()}
      onViewDetails={jest.fn()}
      onUpdateStatus={jest.fn()}
      onToggleFocus={jest.fn()}
      onDeleteOrder={jest.fn()}
    />,
  );

  expect(screen.getByText('legacy 2026-10-14T12:30:00.000Z')).toBeInTheDocument();
});
