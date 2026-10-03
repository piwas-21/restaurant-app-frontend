import { fireEvent, render, screen } from '@testing-library/react';
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
  startRequested: true,
  attemptId: null,
  createdAt: 1,
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

  it('renders a safe server-authored payment failure instead of translating it as a key', () => {
    jest
      .mocked(useGuestAccountPaymentFlow)
      .mockReturnValue(flowResult({ error: 'The reviewed contribution has expired.' }));

    renderPanel(false);

    expect(screen.getByRole('alert')).toHaveTextContent('The reviewed contribution has expired.');
  });
});
