import { render, screen, waitFor } from '@testing-library/react';
import { persistPendingAmendmentCommit } from '@/hooks/orderAmendments/pendingAmendmentCommit';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentCommitRequest } from '@/types/orderAmendment';
import { PaymentMethod } from '@/types/order';
import OrderAmendmentEntryButton from './OrderAmendmentEntryButton';

const mockUseOptionalAuth = jest.fn();
let mockOrderAmendmentsEnabled = true;

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => mockUseOptionalAuth() }));
jest.mock('@/contexts/TenantFeaturesContext', () => ({
  useTenantFeatures: () => ({ orderAmendmentsV1: mockOrderAmendmentsEnabled }),
}));

const order = (type: string, overrides: Partial<OrderDto> = {}) =>
  ({
    id: 'order-1',
    orderNumber: 'A-001',
    type,
    status: 'Ready',
    paymentStatus: 'PartiallyPaid',
    version: 1,
    items: [],
    ...overrides,
  }) as OrderDto;

const pendingRequest: OrderAmendmentCommitRequest = {
  amendmentId: 'amendment-1',
  clientOperationId: '2c844989-5e41-4a94-977b-2a2db27cb38b',
  expectedOrderVersion: 1,
  reviewAcknowledged: true,
};

function persistPending(actorId: string) {
  persistPendingAmendmentCommit({
    actorId,
    sourceOrderId: 'order-1',
    request: pendingRequest,
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
}

describe('OrderAmendmentEntryButton', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockOrderAmendmentsEnabled = true;
    mockUseOptionalAuth.mockReturnValue({ user: { userId: 'actor-1' }, isLoading: false });
  });

  it.each(['DineIn', 'Takeaway', 'Delivery'])('provides a native %s order entry for Server and Cashier', (type) => {
    const { unmount } = render(<OrderAmendmentEntryButton order={order(type)} operatorRole="Server" />);
    expect(screen.getByRole('button', { name: 'orderAmendments.open' })).toBeInTheDocument();
    unmount();

    render(<OrderAmendmentEntryButton order={order(type)} operatorRole="Cashier" />);
    expect(screen.getByRole('button', { name: 'orderAmendments.open' })).toBeInTheDocument();
  });

  it('explains terminal and refund-reconciliation states instead of exposing an amendment action', () => {
    const { rerender } = render(
      <OrderAmendmentEntryButton order={order('DineIn', { status: 'Cancelled' })} operatorRole="Server" />,
    );
    expect(screen.getByText('orderAmendments.cancelled_order')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<OrderAmendmentEntryButton order={order('DineIn', { status: 'Refunded' })} operatorRole="Cashier" />);
    expect(screen.getByText('orderAmendments.fully_refunded_order')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <OrderAmendmentEntryButton
        order={order('DineIn', { status: 'Completed', paymentStatus: 'Refunded' })}
        operatorRole="Cashier"
      />,
    );
    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <OrderAmendmentEntryButton
        order={order('Takeaway', {
          status: 'Completed',
          paymentStatus: 'PartiallyPaid',
          payments: [
            {
              id: 'payment-1',
              orderId: 'order-1',
              paymentMethod: PaymentMethod.Cash,
              amount: 10,
              status: 'PartiallyRefunded',
            },
          ],
        })}
        operatorRole="Cashier"
      />,
    );
    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <OrderAmendmentEntryButton
        order={order('Delivery', {
          status: 'Completed',
          payments: [
            {
              id: 'payment-1',
              orderId: 'order-1',
              paymentMethod: PaymentMethod.Cash,
              amount: 10,
              status: 'Completed',
              refundedAmount: 0,
            },
          ],
        })}
        operatorRole="Admin"
      />,
    );
    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps disabled amendments absent when this actor has no pending operation', () => {
    mockOrderAmendmentsEnabled = false;
    const { container } = render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Cashier" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers actor-scoped recovery while amendments are disabled without exposing a new amendment action', async () => {
    persistPending('actor-1');
    mockOrderAmendmentsEnabled = false;

    render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Server" />);

    expect(screen.getByText('orderAmendments.feature_disabled')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'orderAmendments.check_operation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();
  });

  it('offers read-only recovery for a terminal order with its same-actor pending operation', async () => {
    persistPending('actor-1');

    render(<OrderAmendmentEntryButton order={order('DineIn', { status: 'Cancelled' })} operatorRole="Cashier" />);

    expect(screen.getByText('orderAmendments.cancelled_order')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'orderAmendments.check_operation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();
  });

  it('waits for auth hydration and does not expose another actor’s pending recovery', async () => {
    persistPending('actor-1');
    mockOrderAmendmentsEnabled = false;
    mockUseOptionalAuth.mockReturnValue({ user: { userId: 'actor-1' }, isLoading: true });

    const view = render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Server" />);
    expect(screen.queryByRole('button', { name: 'orderAmendments.check_operation' })).not.toBeInTheDocument();

    mockUseOptionalAuth.mockReturnValue({ user: { userId: 'actor-1' }, isLoading: false });
    view.rerender(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Server" />);
    expect(await screen.findByRole('button', { name: 'orderAmendments.check_operation' })).toBeInTheDocument();

    mockUseOptionalAuth.mockReturnValue({ user: { userId: 'actor-2' }, isLoading: false });
    view.rerender(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Server" />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'orderAmendments.check_operation' })).not.toBeInTheDocument(),
    );
  });
});
