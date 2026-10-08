import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AccountPaymentAllocation } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount, GuestAccountPaymentOperation } from '@/types/guestAccountPayments';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import { useGuestAccountPaymentFlow } from '@/hooks/tableGuest/useGuestAccountPaymentFlow';
import GuestAccountPaymentContributionForm from './GuestAccountPaymentContributionForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/guestAccountPaymentService', () => ({
  guestAccountPaymentService: {
    getAccount: jest.fn(),
    createQuote: jest.fn(),
    retryQuote: jest.fn(),
    createEqualSharePlan: jest.fn(),
    getEqualSharePlan: jest.fn(),
    getOperation: jest.fn(),
    reserve: jest.fn(),
    release: jest.fn(),
    getCheckoutStatus: jest.fn(),
    startCheckout: jest.fn(),
    requestCancellation: jest.fn(),
    getReceipt: jest.fn(),
  },
}));

jest.mock('@/lib/guestAccountPaymentRules', () => ({
  ...jest.requireActual('@/lib/guestAccountPaymentRules'),
  createPaymentOperationId: jest.fn(() => '50000000-0000-4000-8000-000000000001'),
}));

const SESSION_ID = '30000000-0000-4000-8000-000000000001';
const PARTICIPANT_TOKEN = 'synthetic-participant-token';
const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ITEM_ID = '20000000-0000-4000-8000-000000000001';
const PLAN_ID = '40000000-0000-4000-8000-000000000001';
const OPERATION_ID = '50000000-0000-4000-8000-000000000001';
const identity: TableGuestVisitIdentity = {
  serviceSessionId: SESSION_ID,
  participantToken: PARTICIPANT_TOKEN,
  expiresAt: '2030-01-01T00:00:00Z',
};
const planScope: AccountPaymentAllocation[] = [
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 2, unitCount: 1, minorPerUnit: 999, amountMinor: 999 },
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 3, unitCount: 1, minorPerUnit: 1500, amountMinor: 1500 },
];
const remainingScope: AccountPaymentAllocation[] = [
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 3, unitCount: 1, minorPerUnit: 1249, amountMinor: 1249 },
];
const account: GuestAccountPaymentAccount = {
  serviceSessionId: SESSION_ID,
  status: 'Open',
  accountRevision: 14,
  currency: 'CHF',
  outstandingMinor: 1249,
  reservedMinor: 0,
  availableMinor: 1249,
  capturedAccountPaymentMinor: 3251,
  outstandingAllocations: remainingScope,
  availableAllocations: remainingScope,
  activeEqualSharePlan: {
    planId: PLAN_ID,
    accountRevision: 10,
    totalMinor: 2499,
    shareCount: 2,
    currency: 'CHF',
    isOwnPlan: false,
    slots: [
      { ordinal: 1, amountMinor: 1250, claimState: 'Captured', isAvailable: false },
      { ordinal: 2, amountMinor: 1249, claimState: null, isAvailable: true },
    ],
    scope: planScope,
  },
  activeAttempts: [],
  limits: {
    maximumSelectedUnits: 20,
    maximumEqualShares: 8,
    online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 5000 },
  },
};
const quotedOperation: GuestAccountPaymentOperation = {
  serviceSessionId: SESSION_ID,
  operationId: OPERATION_ID,
  state: 'Quoted',
  version: 1,
  expectedAccountRevision: 14,
  mode: 'Equal',
  paymentMethod: 'OnlinePayment',
  amountMinor: 1249,
  currency: 'CHF',
  quoteExpiresAt: '2030-01-01T00:05:00Z',
  reservedAt: null,
  reservationExpiresAt: null,
  equalSharePlanId: PLAN_ID,
  equalShareOrdinal: 2,
  allocations: remainingScope,
};
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalTextEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');

function EqualShareReviewHarness() {
  const flow = useGuestAccountPaymentFlow({
    activeIdentity: identity,
    recoveryIdentity: identity,
    newPaymentsEnabled: true,
    canCreatePayment: true,
    returnAttemptId: null,
    onAccountUpdated: jest.fn(),
  });
  if (!flow.account) return null;
  return (
    <GuestAccountPaymentContributionForm
      account={flow.account}
      tableAccount={null}
      activePlan={flow.account.activeEqualSharePlan}
      disabled={false}
      onReview={flow.reviewContribution}
      onCreatePlan={flow.createEqualSharePlan}
    />
  );
}

describe('equal-share quote after another participant claims the first slot', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
    jest.clearAllMocks();
    jest.mocked(guestAccountPaymentService.getAccount).mockResolvedValue(account);
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: quotedOperation,
      contribution: { amountMinor: 1249, currency: 'CHF', snapshotFingerprint: 'a'.repeat(64) },
    });
  });

  afterEach(() => {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
    if (originalTextEncoder) Object.defineProperty(globalThis, 'TextEncoder', originalTextEncoder);
    else Reflect.deleteProperty(globalThis, 'TextEncoder');
  });

  it('quotes the still-available 1249-minor share at the current account revision', async () => {
    render(<EqualShareReviewHarness />);

    await waitFor(() => expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(1));
    await screen.findByRole('radio', { name: 'table_guest_payment_equal' });
    fireEvent.click(screen.getByRole('radio', { name: 'table_guest_payment_equal' }));
    fireEvent.click(screen.getByRole('radio', { name: 'table_guest_payment_share' }));
    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_review' }));

    await waitFor(() => expect(guestAccountPaymentService.createQuote).toHaveBeenCalledTimes(1));
    expect(guestAccountPaymentService.createQuote).toHaveBeenCalledWith(
      identity,
      expect.objectContaining({
        operationId: OPERATION_ID,
        expectedAccountRevision: 14,
        mode: 'Equal',
        paymentMethod: 'OnlinePayment',
        equalSharePlanId: PLAN_ID,
        equalShareOrdinal: 2,
      }),
      expect.objectContaining({ operationId: OPERATION_ID }),
      account,
    );
  });
});
