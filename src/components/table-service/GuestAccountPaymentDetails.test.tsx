import { render, screen } from '@testing-library/react';
import type { GuestAccountPaymentOperation } from '@/types/guestAccountPayments';
import type { TableGuestAccountDto } from '@/types/tableGuestVisit';
import { PaymentHoldNotice, PaymentOperationReview, PaymentReceipt, PaymentStatus } from './GuestAccountPaymentDetails';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

describe('guest account payment status', () => {
  it('keeps a repeated daily number tied to its business date in payment review', () => {
    const tableAccount: TableGuestAccountDto = {
      serviceSessionId: 'visit-1',
      accountRevision: 2,
      subTotal: 10,
      tax: 0,
      discount: 0,
      tip: 0,
      total: 10,
      totalPaid: 0,
      remaining: 10,
      credit: 0,
      orders: [
        {
          orderId: 'order-1',
          orderNumber: 'legacy-order-id',
          dailyOrderNumber: 1,
          businessDate: '2026-10-14',
          status: 'Preparing',
          paymentStatus: 'Pending',
          orderDate: '2026-10-14T12:00:00Z',
          total: 10,
          totalPaid: 0,
          remainingAmount: 10,
        },
      ],
      items: [
        {
          orderId: 'order-1',
          orderNumber: 'legacy-order-id',
          dailyOrderNumber: 1,
          businessDate: '2026-10-14',
          unitCount: 1,
          item: {
            itemId: 'item-1',
            productName: 'Soup',
            quantity: 1,
            unitPrice: 10,
            itemTotal: 10,
            ingredientCustomizations: [],
            sideItems: [],
          },
        },
      ],
    };
    const operation: GuestAccountPaymentOperation = {
      serviceSessionId: 'visit-1',
      operationId: 'operation-1',
      state: 'Quoted',
      version: 1,
      expectedAccountRevision: 2,
      mode: 'Items',
      paymentMethod: 'OnlinePayment',
      amountMinor: 1000,
      currency: 'CHF',
      quoteExpiresAt: '2026-10-14T12:05:00Z',
      reservedAt: null,
      reservationExpiresAt: null,
      equalSharePlanId: null,
      equalShareOrdinal: null,
      allocations: [
        {
          orderId: 'order-1',
          orderItemId: 'item-1',
          startOrdinal: 1,
          unitCount: 1,
          minorPerUnit: 1000,
          amountMinor: 1000,
        },
      ],
    };

    render(
      <PaymentOperationReview
        operation={operation}
        tableAccount={tableAccount}
        canContinue
        isWorking={false}
        onContinue={async () => true}
        onRelease={async () => true}
      />,
    );

    expect(screen.getByText('Oct 14, 2026', { selector: 'time' })).toHaveAttribute('datetime', '2026-10-14');
  });

  it('labels a captured checkout as reconciliation required when the server marks it uncertain', () => {
    render(
      <PaymentStatus
        state="Captured"
        amountMinor={1250}
        currency="CHF"
        receivedMinor={1250}
        refundedMinor={0}
        reconciliationRequired
        isWorking={false}
        isRecoveryPolling={false}
        isCancellationWorking={false}
        retryOriginal={false}
        showStatus
        canCancel={false}
        onRetry={async () => true}
        onRefresh={async () => true}
        onCancel={async () => true}
      />,
    );

    expect(screen.getByText('table_guest_payment_ReconciliationRequired')).toBeInTheDocument();
    expect(screen.queryByText('table_guest_payment_Captured')).not.toBeInTheDocument();
  });

  it('uses the reconciliation label on the capability receipt too', () => {
    render(
      <PaymentReceipt
        locale="en"
        receipt={{
          attemptId: '00000000-0000-4000-8000-000000000001',
          amountMinor: 1250,
          currency: 'CHF',
          state: 'Captured',
          receivedMinor: 1250,
          refundedMinor: 0,
          reconciliationRequired: true,
          completedAt: null,
        }}
      />,
    );

    expect(screen.getByText('table_guest_payment_ReconciliationRequired')).toBeInTheDocument();
    expect(screen.queryByText('table_guest_payment_Captured')).not.toBeInTheDocument();
  });

  it('announces held payment status through a native output element', () => {
    render(<PaymentHoldNotice state="Processing" reconciliationRequired={false} />);

    const status = screen.getByRole('status');
    expect(status.tagName).toBe('OUTPUT');
    expect(status).toHaveTextContent('table_guest_payment_pending');
  });
});
