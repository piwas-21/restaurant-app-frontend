import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderList from './OrderList';
import { OrderType } from '@/types/order';
import type { OrderDto } from '@/types/order';

/**
 * #336 — the status pill's fill is decided by the SHARED `orderStatusBadgeFill` key; this
 * module only binds the key to its own classes. These pins hold both halves: the six fills
 * stay byte-identical to the switch this replaced, and the statuses outside them still take
 * the neutral completed fill. The e2e cashier flow asserts these pills by TEXT, so the class
 * names are free to stay exactly as they are — which is the point of the pin.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const buildOrder = (overrides: Partial<Record<string, unknown>> = {}): OrderDto =>
  ({
    id: 'o1',
    orderNumber: '1042',
    status: 'Ready',
    type: OrderType.Delivery,
    total: 42,
    orderDate: new Date('2026-08-28T15:45:12Z').toISOString(),
    items: [],
    ...overrides,
  }) as unknown as OrderDto;

const renderList = (order: OrderDto) =>
  render(
    <OrderList orders={[order]} selectedOrderId={null} onSelectOrder={jest.fn()} isLoading={false} error={null} />,
  );

it.each([
  ['Pending', 'orderStatusBadgePending'],
  ['Confirmed', 'orderStatusBadgeConfirmed'],
  ['Preparing', 'orderStatusBadgePreparing'],
  ['Ready', 'orderStatusBadgeReady'],
  ['Cancelled', 'orderStatusBadgeCancelled'],
  ['Completed', 'orderStatusBadgeCompleted'],
  // Outside the six fills — the neutral grey the replaced switch's default returned.
  ['PendingApproval', 'orderStatusBadgeCompleted'],
  ['OutForDelivery', 'orderStatusBadgeCompleted'],
  ['InTransit', 'orderStatusBadgeCompleted'],
  ['Delivered', 'orderStatusBadgeCompleted'],
  ['Refunded', 'orderStatusBadgeCompleted'],
  ['SomeFutureStatus', 'orderStatusBadgeCompleted'],
])('a %s pill wears %s', (status, modifier) => {
  renderList(buildOrder({ status }));

  const pill = document.querySelector('span.orderStatusBadge');
  expect(pill).toHaveClass('orderStatusBadge', modifier);
});

it.each([
  ['PendingApproval', 'order_status_pending_approval'],
  ['OutForDelivery', 'order_status_in_transit'],
  ['In Progress', 'order_status_in_progress'],
])('renders %s with its canonical translated key', (status, label) => {
  renderList(buildOrder({ status }));
  expect(screen.getByText(label)).toBeInTheDocument();
});

it('still renders when the order list is empty', () => {
  render(<OrderList orders={[]} selectedOrderId={null} onSelectOrder={jest.fn()} isLoading={false} error={null} />);
  expect(screen.getByText('No orders found')).toBeInTheDocument();
});
