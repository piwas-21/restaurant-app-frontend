import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { persistPendingAmendmentCommit } from '@/hooks/orderAmendments/pendingAmendmentCommit';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentCommitRequest } from '@/types/orderAmendment';
import { PaymentMethod } from '@/types/order';
import OrderAmendmentEntryButton from './OrderAmendmentEntryButton';

const mockUseOptionalAuth = jest.fn();
const mockRetryActor = jest.fn();
let mockActorFailed = false;
const mockLoadTranslations = jest.fn((_enabled: boolean) => ({ ready: true, failed: false, retry: jest.fn() }));
let mockOrderAmendmentsEnabled = true;
const mockEligibility = jest.fn(() => ({
  reason: null as string | null,
  ready: true,
  mode: 'Native',
  retry: jest.fn(),
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('next/dynamic', () => {
  const React: typeof import('react') = jest.requireActual('react');
  return {
    __esModule: true,
    default: () => {
      function MockAmendmentModal({ recoveryOnly }: { readonly recoveryOnly?: boolean }) {
        const [draft, setDraft] = React.useState('');
        return React.createElement(
          'section',
          { role: 'dialog', 'aria-label': 'Amendment modal', 'data-recovery-only': String(recoveryOnly) },
          React.createElement(
            'label',
            null,
            'Draft reason',
            React.createElement('input', {
              value: draft,
              onChange: (event: { currentTarget: HTMLInputElement }) => setDraft(event.currentTarget.value),
            }),
          ),
        );
      }
      return MockAmendmentModal;
    },
  };
});
jest.mock('@/hooks/accountPayments/useAccountPaymentActor', () => ({
  useAccountPaymentActor: () => {
    const auth = mockUseOptionalAuth();
    return {
      actorId: auth.isLoading || mockActorFailed ? undefined : auth.user?.userId,
      status: auth.isLoading ? 'checking' : mockActorFailed ? 'failed' : 'ready',
      retry: mockRetryActor,
    };
  },
}));
jest.mock('@/hooks/orderAmendments/useOrderAmendmentEligibility', () => ({
  useOrderAmendmentEligibility: () => mockEligibility(),
}));
jest.mock('@/contexts/TenantFeaturesContext', () => ({
  useTenantFeatures: () => ({ orderAmendmentsV1: mockOrderAmendmentsEnabled }),
}));
jest.mock('@/hooks/orderAmendments/useOrderAmendmentTranslations', () => ({
  useOrderAmendmentTranslations: (enabled: boolean) => mockLoadTranslations(enabled),
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
    mockActorFailed = false;
    mockRetryActor.mockClear();
    mockLoadTranslations.mockClear();
    mockEligibility.mockReturnValue({ reason: null, ready: true, mode: 'Native', retry: jest.fn() });
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

  it('keeps the open amendment modal mounted when refreshed eligibility changes', async () => {
    const view = render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Server" />);
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.open' }));
    const dialog = await screen.findByRole('dialog', { name: 'Amendment modal' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Draft reason' }), {
      target: { value: 'Keep the reviewed draft visible.' },
    });

    mockEligibility.mockReturnValue({
      reason: 'orderAmendments.order_refund_activity',
      ready: false,
      mode: 'None',
      retry: jest.fn(),
    });
    view.rerender(<OrderAmendmentEntryButton order={order('DineIn', { version: 2 })} operatorRole="Server" />);

    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Amendment modal' })).toHaveAttribute(
      'data-recovery-only',
      'true',
    );
    expect(within(dialog).getByRole('textbox', { name: 'Draft reason' })).toHaveValue(
      'Keep the reviewed draft visible.',
    );
  });

  it('does not carry an open amendment draft across actor identity changes', async () => {
    const view = render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Server" />);
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.open' }));
    const dialog = await screen.findByRole('dialog', { name: 'Amendment modal' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Draft reason' }), {
      target: { value: 'Actor-scoped draft.' },
    });

    mockUseOptionalAuth.mockReturnValue({ user: { userId: 'actor-2' }, isLoading: false });
    view.rerender(<OrderAmendmentEntryButton order={order('DineIn', { version: 2 })} operatorRole="Server" />);

    const replacementDialog = await screen.findByRole('dialog', { name: 'Amendment modal' });
    expect(within(replacementDialog).getByRole('textbox', { name: 'Draft reason' })).toHaveValue('');
  });

  it('explains terminal and refund-reconciliation states instead of exposing an amendment action', () => {
    const { rerender } = render(
      <OrderAmendmentEntryButton order={order('DineIn', { status: 'Cancelled' })} operatorRole="Server" />,
    );
    expect(screen.getByText('orderAmendments.cancelled_order')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();

    rerender(<OrderAmendmentEntryButton order={order('DineIn', { status: 'Refunded' })} operatorRole="Cashier" />);
    expect(screen.getByText('orderAmendments.fully_refunded_order')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();

    mockEligibility.mockReturnValue({
      reason: 'orderAmendments.order_refund_activity',
      ready: false,
      mode: 'None',
      retry: jest.fn(),
    });
    rerender(
      <OrderAmendmentEntryButton
        order={order('DineIn', { status: 'Completed', paymentStatus: 'Refunded' })}
        operatorRole="Cashier"
      />,
    );
    expect(screen.getByText('orderAmendments.order_refund_activity')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();

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
    expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();

    mockEligibility.mockReturnValue({ reason: null, ready: true, mode: 'Native', retry: jest.fn() });
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
    expect(screen.getByRole('button', { name: 'orderAmendments.open' })).toBeInTheDocument();
  });

  it('keeps disabled amendments absent when this actor has no pending operation', () => {
    mockOrderAmendmentsEnabled = false;
    const { container } = render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Cashier" />);
    expect(container).toBeEmptyDOMElement();
    expect(mockLoadTranslations).toHaveBeenLastCalledWith(false);
  });

  it('offers actor-scoped recovery while amendments are disabled without exposing a new amendment action', async () => {
    persistPending('actor-1');
    mockOrderAmendmentsEnabled = false;

    render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole="Server" />);

    expect(screen.getByText('orderAmendments.feature_disabled')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'orderAmendments.check_operation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();
    expect(mockLoadTranslations).toHaveBeenLastCalledWith(true);
  });

  it.each(['Server', 'Cashier'] as const)(
    'keeps identity retry available to %s while writes are disabled and recovers only after identity resolves',
    async (operatorRole) => {
      persistPending('actor-1');
      mockOrderAmendmentsEnabled = false;
      mockActorFailed = true;
      const storageRead = jest.spyOn(Storage.prototype, 'getItem');
      const view = render(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole={operatorRole} />);
      expect(screen.getByText('orderAmendments.resolution_context_failed')).toBeInTheDocument();
      expect(storageRead).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'orderAmendments.check_operation' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'retry' }));
      expect(mockRetryActor).toHaveBeenCalledTimes(1);
      expect(mockLoadTranslations).toHaveBeenLastCalledWith(true);

      mockActorFailed = false;
      view.rerender(<OrderAmendmentEntryButton order={order('DineIn')} operatorRole={operatorRole} />);
      expect(await screen.findByRole('button', { name: 'orderAmendments.check_operation' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();
      storageRead.mockRestore();
    },
  );

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
