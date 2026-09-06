import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderDetails from './OrderDetails';
import { OrderType } from '@/types/order';
import type { OrderDto } from '@/types/order';

/**
 * #336 — the twin of the OrderList pin: this pill's fill is decided by the SHARED
 * `orderStatusBadgeFill` key, bound here to OrderDetails.module.css. The two switches that
 * used to carry this mapping drifted once already (a contrast fix landed on one and not the
 * other), so both components are pinned against the same six fills + neutral fallback.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const buildOrder = (overrides: Partial<Record<string, unknown>> = {}): OrderDto =>
  ({
    id: 'o1',
    orderNumber: '1042',
    status: 'Ready',
    type: OrderType.DineIn,
    total: 42,
    totalPaid: 0,
    orderDate: new Date('2026-08-28T15:45:12Z').toISOString(),
    items: [],
    payments: [],
    orderNotes: '',
    customerName: 'Ayşe',
    ...overrides,
  }) as unknown as OrderDto;

const renderDetails = (order: OrderDto) =>
  render(
    <OrderDetails
      order={order}
      onStatusChange={jest.fn().mockResolvedValue(undefined)}
      onAddPayment={jest.fn()}
      onRefund={jest.fn()}
      onCancel={jest.fn()}
      onToggleFocus={jest.fn()}
    />,
  );

it.each([
  ['Pending', 'statusBadgePending'],
  ['Confirmed', 'statusBadgeConfirmed'],
  ['Preparing', 'statusBadgePreparing'],
  ['Ready', 'statusBadgeReady'],
  ['Cancelled', 'statusBadgeCancelled'],
  ['Completed', 'statusBadgeCompleted'],
  // Outside the six fills — the neutral grey the replaced switch's default returned.
  ['OutForDelivery', 'statusBadgeCompleted'],
  ['InTransit', 'statusBadgeCompleted'],
  ['Delivered', 'statusBadgeCompleted'],
  ['SomeFutureStatus', 'statusBadgeCompleted'],
])('a %s pill wears %s', (status, modifier) => {
  renderDetails(buildOrder({ status }));

  const pill = screen.getByText(status);
  expect(pill).toHaveClass('statusBadge', modifier);
});

it('shows the empty state without an order', () => {
  renderDetails(null as unknown as OrderDto);
  expect(screen.getByText('Select an order to view details')).toBeInTheDocument();
});
