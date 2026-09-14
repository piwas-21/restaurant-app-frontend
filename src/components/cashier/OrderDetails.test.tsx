import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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

  const pill = document.querySelector('span.statusBadge');
  expect(pill).toHaveClass('statusBadge', modifier);
});

it.each([
  ['PendingApproval', 'order_status_pending_approval'],
  ['OutForDelivery', 'order_status_in_transit'],
  ['In Progress', 'order_status_in_progress'],
])('renders %s with its canonical translated key', (status, label) => {
  renderDetails(buildOrder({ status }));
  expect(screen.getByText(label)).toBeInTheDocument();
});

it('shows the empty state without an order', () => {
  renderDetails(null as unknown as OrderDto);
  expect(screen.getByText('Select an order to view details')).toBeInTheDocument();
});

/**
 * C07/C06 (POS plan): permitted actions come from the SHARED transition table, and the
 * collect control follows the backend settlement rule (#522) — completed-but-unpaid stays
 * collectible, cancelled/refunded/credited never reopen debt.
 */
describe('OrderDetails — permitted actions', () => {
  it('offers OutForDelivery after Ready — an action the old five-state slice dropped', () => {
    renderDetails(buildOrder({ status: 'Ready' }));
    fireEvent.click(screen.getByText('Update Status'));
    expect(screen.getByText('OutForDelivery')).toBeInTheDocument();
    expect(screen.queryByText('Completed')).toBeInTheDocument();
  });

  it('never offers an illegal skip from Pending', () => {
    renderDetails(buildOrder({ status: 'Pending' }));
    fireEvent.click(screen.getByText('Update Status'));
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByText('Preparing')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('offers Collect on a completed-but-unpaid sale', () => {
    renderDetails(buildOrder({ status: 'Completed', paymentStatus: 'Pending', remainingAmount: 42, total: 42 }));
    expect(screen.getByText('Payment')).toBeInTheDocument();
  });

  it('hides Collect for a cancelled order', () => {
    renderDetails(buildOrder({ status: 'Cancelled', paymentStatus: 'Pending', remainingAmount: 42, total: 42 }));
    expect(screen.queryByText('Payment')).not.toBeInTheDocument();
  });

  it('hides Collect for a fully refunded order', () => {
    renderDetails(
      buildOrder({
        status: 'Completed',
        paymentStatus: 'Refunded',
        remainingAmount: 42,
        total: 42,
        payments: [{ id: 'p1', status: 'Refunded', isRefunded: true, refundedAmount: 42 }],
      }),
    );
    expect(screen.queryByText('Payment')).not.toBeInTheDocument();
  });

  it('hides Collect once nothing is owed', () => {
    renderDetails(
      buildOrder({ status: 'Completed', paymentStatus: 'Completed', remainingAmount: 0, total: 42, totalPaid: 42 }),
    );
    expect(screen.queryByText('Payment')).not.toBeInTheDocument();
  });
});
