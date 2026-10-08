import { fireEvent, render, screen } from '@testing-library/react';
import type { GuestAccountPaymentOperation } from '@/types/guestAccountPayments';
import type { GuestPaymentAttemptSummary } from '@/types/guestPaymentRecovery';
import { useGuestAccountPaymentFlow } from '@/hooks/tableGuest/useGuestAccountPaymentFlow';
import GuestAccountPaymentPanel from './GuestAccountPaymentPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@/hooks/tableGuest/useGuestAccountPaymentFlow', () => ({ useGuestAccountPaymentFlow: jest.fn() }));

const returnedAttemptId = '00000000-0000-4000-8000-000000000020';
const attempt: GuestPaymentAttemptSummary = {
  serviceSessionId: '00000000-0000-4000-8000-000000000001',
  operationId: '00000000-0000-4000-8000-000000000010',
  mode: 'Amount',
  quotedVersion: 1,
  reservedExpectedVersion: 2,
  hasReceiptCredential: true,
  unfinishedQuote: false,
  startRequested: true,
  attemptId: null,
  createdAt: 1,
};
const paymentOperation: GuestAccountPaymentOperation = {
  serviceSessionId: attempt.serviceSessionId,
  operationId: attempt.operationId,
  state: 'Processing',
  version: 2,
  expectedAccountRevision: 1,
  mode: 'Amount',
  paymentMethod: 'OnlinePayment',
  amountMinor: 1250,
  currency: 'CHF',
  quoteExpiresAt: '2030-01-01T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: null,
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [],
};

function flowResult(overrides: Partial<ReturnType<typeof useGuestAccountPaymentFlow>> = {}) {
  return {
    account: null,
    attempt,
    operation: null,
    checkout: null,
    receipts: [],
    isLoading: false,
    isAccountLoading: false,
    isWorking: false,
    storageUnavailable: false,
    returnReceiptUnavailable: true,
    error: '',
    canReplaceAttempt: false,
    pendingPlanIntent: null,
    planRecoveryLoading: false,
    planRecoveryBlocked: false,
    planRecoveryError: '',
    planRetryAvailable: false,
    resolveOriginalPlan: jest.fn(),
    refreshAccount: jest.fn(),
    reviewContribution: jest.fn(),
    retryUnfinishedQuote: jest.fn(),
    discardUnfinishedQuote: jest.fn(),
    createEqualSharePlan: jest.fn(),
    refreshPaymentStatus: jest.fn().mockResolvedValue(true),
    releaseBeforeStart: jest.fn(),
    requestCancellation: jest.fn(),
    startOrResumeCheckout: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useGuestAccountPaymentFlow>;
}

function renderPanel(returnHintPresent = true) {
  return render(
    <GuestAccountPaymentPanel
      tableAccount={null}
      activeIdentity={null}
      recoveryIdentity={null}
      newPaymentsEnabled={false}
      canCreatePayment={false}
      returnAttemptId={returnHintPresent ? returnedAttemptId : null}
      returnHintPresent={returnHintPresent}
      onAccountUpdated={jest.fn()}
    />,
  );
}

describe('GuestAccountPaymentPanel', () => {
  it('offers a private receipt retry after the visit ended with only the provider return id', () => {
    const currentFlow = flowResult();
    jest.mocked(useGuestAccountPaymentFlow).mockReturnValue(currentFlow);
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_status' }));
    expect(currentFlow.refreshPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it('disables checkout retry while returned-payment recovery is loading', () => {
    const activeIdentity = {
      serviceSessionId: attempt.serviceSessionId,
      participantToken: 'participant-secret',
      expiresAt: '2030-01-01T00:00:00Z',
    };
    jest
      .mocked(useGuestAccountPaymentFlow)
      .mockReturnValue(flowResult({ operation: paymentOperation, isLoading: true }));
    render(
      <GuestAccountPaymentPanel
        tableAccount={null}
        activeIdentity={activeIdentity}
        recoveryIdentity={activeIdentity}
        newPaymentsEnabled
        canCreatePayment
        returnAttemptId={returnedAttemptId}
        returnHintPresent
        onAccountUpdated={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'table_guest_payment_retry_original' })).toBeDisabled();
  });

  it('shows the generic receipt-unavailable state for a saved attempt without a return hint', () => {
    jest
      .mocked(useGuestAccountPaymentFlow)
      .mockReturnValue(flowResult({ attempt: { ...attempt, attemptId: returnedAttemptId } }));

    renderPanel(false);

    const status = screen.getByText('table_guest_payment_return_missing');
    expect(status.tagName).toBe('OUTPUT');
    expect(status).toHaveTextContent('table_guest_payment_return_missing');
  });

  it('offers retry and explicit discard only for a marker-free unfinished quote', () => {
    const retryUnfinishedQuote = jest.fn().mockResolvedValue(true);
    const discardUnfinishedQuote = jest.fn().mockResolvedValue(true);
    const unfinishedAttempt = {
      ...attempt,
      quotedVersion: null,
      reservedExpectedVersion: null,
      hasReceiptCredential: false,
      unfinishedQuote: true,
      startRequested: false,
      attemptId: null,
    };
    jest
      .mocked(useGuestAccountPaymentFlow)
      .mockReturnValue(flowResult({ attempt: unfinishedAttempt, retryUnfinishedQuote, discardUnfinishedQuote }));
    render(
      <GuestAccountPaymentPanel
        tableAccount={null}
        activeIdentity={{
          serviceSessionId: attempt.serviceSessionId,
          participantToken: 'participant-secret',
          expiresAt: '2030-01-01T00:00:00Z',
        }}
        recoveryIdentity={null}
        newPaymentsEnabled
        canCreatePayment
        returnAttemptId={null}
        returnHintPresent={false}
        onAccountUpdated={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_retry_original' }));
    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_discard_unfinished_quote' }));

    expect(retryUnfinishedQuote).toHaveBeenCalledTimes(1);
    expect(discardUnfinishedQuote).toHaveBeenCalledTimes(1);
  });

  it('renders a localized load fallback for a server failure', () => {
    jest.mocked(useGuestAccountPaymentFlow).mockReturnValue(flowResult({ error: 'load' }));

    renderPanel(false);

    expect(screen.getByRole('alert')).toHaveTextContent('table_guest_payment_load_failed');
  });

  it('requires the separate reviewed-quote Continue action before starting checkout', () => {
    const startOrResumeCheckout = jest.fn().mockResolvedValue(true);
    jest.mocked(useGuestAccountPaymentFlow).mockReturnValue(
      flowResult({
        attempt: { ...attempt, startRequested: false },
        operation: {
          serviceSessionId: attempt.serviceSessionId,
          operationId: attempt.operationId,
          state: 'Quoted',
          version: 1,
          expectedAccountRevision: 2,
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 500,
          currency: 'CHF',
          quoteExpiresAt: '2030-01-01T00:10:00Z',
          reservedAt: null,
          reservationExpiresAt: null,
          equalSharePlanId: null,
          equalShareOrdinal: null,
          allocations: [],
        },
        startOrResumeCheckout,
      }),
    );

    render(
      <GuestAccountPaymentPanel
        tableAccount={null}
        activeIdentity={null}
        recoveryIdentity={null}
        newPaymentsEnabled
        canCreatePayment
        returnAttemptId={null}
        returnHintPresent={false}
        onAccountUpdated={jest.fn()}
      />,
    );

    expect(startOrResumeCheckout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_continue' }));
    expect(startOrResumeCheckout).toHaveBeenCalledTimes(1);
  });
});
