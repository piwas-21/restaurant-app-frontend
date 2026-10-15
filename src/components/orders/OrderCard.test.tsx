import { render, screen } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import OrderCard from './OrderCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: jest.fn() }) }));

jest.mock('./orderFormatters', () => ({
  formatPrice: (value: number) => `EUR ${value}`,
  formatDate: (value: string) => `legacy ${value}`,
}));

function buildOrder(id: string, date?: string, timeZone?: string): OrderDto {
  return {
    id,
    orderNumber: `full-${id}`,
    dailyOrderNumber: date ? 1 : undefined,
    businessDate: date,
    businessTimeZoneId: timeZone,
    orderDate: '2026-10-14T12:30:00.000Z',
    status: 'Confirmed',
    type: 'Takeaway',
    items: [],
    total: 10,
    subTotal: 10,
    discount: 0,
    deliveryFee: 0,
    tax: 0,
    tip: 0,
  } as unknown as OrderDto;
}

function renderCards(orders: OrderDto[]) {
  const onToggleExpand = jest.fn();
  const onReorder = jest.fn();
  render(
    <>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          isExpanded={false}
          onToggleExpand={onToggleExpand}
          isReordering={false}
          onReorder={onReorder}
        />
      ))}
    </>,
  );
}

it('shows business dates and tenant-zone times for repeated guest history numbers', () => {
  renderCards([
    buildOrder('first', '2026-10-14', 'Europe/Zurich'),
    {
      ...buildOrder('second', '2026-10-15', 'Europe/Zurich'),
      orderDate: '2026-10-15T12:45:00.000Z',
    } as OrderDto,
  ]);

  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(screen.getByText('Oct 14, 2026')).toBeInTheDocument();
  expect(screen.getByText('Oct 15, 2026')).toBeInTheDocument();
  expect(screen.getByText('02:30 PM')).toBeInTheDocument();
  expect(screen.getByText('02:45 PM')).toBeInTheDocument();
});

it('shows only the authoritative date when its zone is missing and preserves legacy timestamps without a date', () => {
  renderCards([buildOrder('unknown-zone', '2026-10-14'), buildOrder('legacy')]);

  expect(screen.getByText('Oct 14, 2026')).toBeInTheDocument();
  expect(screen.getByText('legacy 2026-10-14T12:30:00.000Z')).toBeInTheDocument();
  expect(screen.getAllByText('1')).toHaveLength(1);
});
