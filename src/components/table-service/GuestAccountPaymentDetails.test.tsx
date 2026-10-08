import { render, screen } from '@testing-library/react';
import { PaymentHoldNotice, PaymentReceipt, PaymentStatus } from './GuestAccountPaymentDetails';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

describe('guest account payment status', () => {
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
