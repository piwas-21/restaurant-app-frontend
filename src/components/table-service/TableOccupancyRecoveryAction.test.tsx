import { render, screen } from '@testing-library/react';
import TableOccupancyRecoveryAction from './TableOccupancyRecoveryAction';

const mockRecoveryState = {
  stage: 'previewed',
  preview: {
    tableId: '22222222-2222-4222-8222-222222222222',
    tableNumber: '9',
    serviceSessionId: '33333333-3333-4333-8333-333333333333',
    readinessVersion: 2,
    sessionVersion: 4,
    accountRevision: 7,
    currency: 'CHF',
    previewFingerprint: 'a'.repeat(64),
    orderCount: 1,
    cancelableUnsentCount: 0,
    legacyUnassignedCount: 0,
    routedOrderCount: 1,
    preparingOrderCount: 0,
    readyOrderCount: 1,
    paidOrRefundedOrderCount: 0,
    activePaymentAttemptCount: 0,
    pendingPaymentHandoffCount: 0,
    checkoutAttemptCount: 0,
    preservedOutstandingAmount: 15,
    orders: [
      {
        orderId: '44444444-4444-4444-8444-444444444444',
        orderNumber: '202610090025',
        disposition: 'RetainedInPriorVisit',
        originalStatus: 'Ready',
        originalPaymentStatus: 'PartiallyPaid',
        originalTotal: 15,
        originalBillingCreditAmount: 0,
        originalTotalPaid: 5,
        originalRemainingAmount: 10,
        wasLegacyUnassigned: false,
        wasKitchenReleased: true,
        hadRoutingHistory: true,
      },
    ],
  },
  operation: undefined,
  currency: 'CHF',
  error: undefined,
  reason: '',
  setReason: jest.fn(),
  startPreview: jest.fn(),
  closePreview: jest.fn(),
  confirm: jest.fn(),
  check: jest.fn(),
  retry: jest.fn(),
};

jest.mock('@/hooks/tableReadiness/useTableOccupancyRecovery', () => ({
  useTableOccupancyRecovery: () => mockRecoveryState,
}));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => ({ user: { role: 'Cashier' } }) }));
jest.mock('@/hooks/accountPayments/useAccountPaymentActor', () => ({
  useAccountPaymentActor: () => ({
    actorId: '11111111-1111-4111-8111-111111111111',
    status: 'ready',
    retry: jest.fn(),
  }),
}));
jest.mock('@/services/accountPaymentLocaleService', () => ({
  loadAccountPaymentLocale: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => `${key}:${values?.status ?? ''}:${values?.payment ?? ''}`,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@/components/design-system/BaseModal', () => ({
  __esModule: true,
  default: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

it('shows order numbers and translated states without exposing implementation UUIDs', async () => {
  render(
    <TableOccupancyRecoveryAction
      tableId={mockRecoveryState.preview.tableId}
      serviceSessionId={mockRecoveryState.preview.serviceSessionId ?? undefined}
      enabled
      onRecovered={jest.fn(async () => undefined)}
    />,
  );

  expect(await screen.findByText('202610090025')).toBeInTheDocument();
  expect(screen.getByText(/order_status_ready/)).toBeInTheDocument();
  expect(screen.getByText(/payment_status_partially_paid/)).toBeInTheDocument();
  expect(screen.queryByText(mockRecoveryState.preview.orders[0].orderId)).not.toBeInTheDocument();
});

it('keeps an open preview visible but disables confirmation while the table is stale', async () => {
  render(
    <TableOccupancyRecoveryAction
      tableId={mockRecoveryState.preview.tableId}
      serviceSessionId={mockRecoveryState.preview.serviceSessionId ?? undefined}
      enabled
      disabled
      onRecovered={jest.fn(async () => undefined)}
    />,
  );
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'accountPayments.recovery.confirm::' })).toBeDisabled();
});
