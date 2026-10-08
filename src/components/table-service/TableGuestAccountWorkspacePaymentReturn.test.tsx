import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { I18nextProvider } from 'react-i18next';
import { render, screen, waitFor } from '@testing-library/react';
import i18n from '../../i18n';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  createGuestAccountPaymentDescriptor,
  saveGuestAccountPaymentAttempt,
  withCheckoutAttempt,
  withQuotedOperation,
  withReservation,
  withStartRequested,
} from '@/services/guestAccountPaymentStorage';
import { tableGuestVisitService } from '@/services/tableGuestVisitService';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentOperation,
  GuestPaymentReceipt,
} from '@/types/guestAccountPayments';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import TableGuestAccountWorkspace from './TableGuestAccountWorkspace';

jest.mock('next/navigation', () => ({
  usePathname: () => '/en/table-account',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: () => ({ clearOrderType: jest.fn() }) }));
jest.mock('@/contexts/TableContext', () => ({ useTableContext: () => ({ clearTableContext: jest.fn() }) }));
jest.mock('@/services/tableGuestVisitService', () => ({
  tableGuestVisitService: {
    joinTableGuestVisit: jest.fn(),
    getTableGuestAccount: jest.fn(),
    createTableGuestRound: jest.fn(),
  },
}));
jest.mock('@/services/guestAccountPaymentService', () => ({
  guestAccountPaymentService: {
    getOperation: jest.fn(),
    getCheckoutStatus: jest.fn(),
    getReceipt: jest.fn(),
    startCheckout: jest.fn(),
  },
}));

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000010';
const ATTEMPT_ID = '00000000-0000-4000-8000-000000000020';
const ORDER_ID = '00000000-0000-4000-8000-000000000030';
const identity: TableGuestVisitIdentity = {
  serviceSessionId: SESSION_ID,
  participantToken: 'x'.repeat(40),
  expiresAt: '2030-01-01T00:00:00Z',
};
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalTextEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');

function paymentOperation(state: GuestAccountPaymentOperation['state']): GuestAccountPaymentOperation {
  return {
    serviceSessionId: SESSION_ID,
    operationId: OPERATION_ID,
    state,
    version: state === 'Captured' ? 4 : 3,
    expectedAccountRevision: 1,
    mode: 'Amount',
    paymentMethod: 'OnlinePayment',
    amountMinor: 1500,
    currency: 'CHF',
    quoteExpiresAt: '2030-01-01T00:00:00Z',
    reservedAt: null,
    reservationExpiresAt: null,
    equalSharePlanId: null,
    equalShareOrdinal: null,
    allocations: [
      { orderId: ORDER_ID, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 1500, amountMinor: 1500 },
    ],
  };
}

function checkout(state: GuestAccountCheckoutStatus['state']): GuestAccountCheckoutStatus {
  return {
    attemptId: ATTEMPT_ID,
    operationId: OPERATION_ID,
    state,
    version: state === 'Captured' ? 4 : 3,
    amountMinor: 1500,
    currency: 'CHF',
    expiresAt: '2030-01-01T00:10:00Z',
    checkoutUrl: null,
    reconciliationRequired: false,
    receivedMinor: state === 'Captured' ? 1500 : 0,
    refundedMinor: 0,
  };
}

function receipt(state: GuestPaymentReceipt['state']): GuestPaymentReceipt {
  return {
    attemptId: ATTEMPT_ID,
    amountMinor: 1500,
    currency: 'CHF',
    state,
    receivedMinor: state === 'Captured' ? 1500 : 0,
    refundedMinor: 0,
    reconciliationRequired: false,
    completedAt: state === 'Captured' ? '2030-01-01T00:01:00Z' : null,
  };
}

describe('table-account payment return during visit hydration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
    jest.clearAllMocks();
    jest.mocked(tableGuestVisitService.getTableGuestAccount).mockResolvedValue({
      serviceSessionId: SESSION_ID,
      tableLabel: '12',
      currency: 'CHF',
      accountRevision: 1,
      subTotal: 15,
      tax: 0,
      discount: 0,
      tip: 0,
      total: 15,
      totalPaid: 0,
      remaining: 15,
      credit: 0,
      orders: [],
      items: [],
    });
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockImplementation(async () =>
        jest.mocked(guestAccountPaymentService.getCheckoutStatus).mock.calls.length > 1
          ? paymentOperation('Captured')
          : paymentOperation('Processing'),
      );
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockImplementation(async () =>
        checkout(
          jest.mocked(guestAccountPaymentService.getCheckoutStatus).mock.calls.length > 1 ? 'Captured' : 'Processing',
        ),
      );
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockImplementation(async () =>
        receipt(jest.mocked(guestAccountPaymentService.getReceipt).mock.calls.length > 1 ? 'Captured' : 'Processing'),
      );
    window.history.replaceState(null, '', `/en/table-account?paymentAttempt=${ATTEMPT_ID}&canceled=0`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
    if (originalTextEncoder) Object.defineProperty(globalThis, 'TextEncoder', originalTextEncoder);
    else Reflect.deleteProperty(globalThis, 'TextEncoder');
  });

  it('keeps the provider-return attempt across loading-to-active hydration and polls to its matched receipt', async () => {
    const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
    const quoted = withQuotedOperation(
      createGuestAccountPaymentDescriptor(
        SESSION_ID,
        OPERATION_ID,
        { expectedAccountRevision: 1, mode: 'Amount', paymentMethod: 'OnlinePayment', amountMinor: 1500 },
        participantFingerprint,
      ),
      1,
      { amountMinor: 1500, currency: 'CHF', snapshotFingerprint: 'a'.repeat(64) },
    );
    const started = withCheckoutAttempt(withStartRequested(withReservation(quoted, 2, 'A'.repeat(43))), ATTEMPT_ID);
    expect(saveGuestAccountPaymentAttempt(started)).toBe(true);
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    await waitFor(() => expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(1));
    expect(window.location.search).toBe('');
    await waitFor(() => expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(2), {
      timeout: 8_000,
    });
    const receiptRegion = screen.getByRole('region', { name: 'Your contribution' });
    expect(receiptRegion).toHaveTextContent('Payment confirmed');
    expect(receiptRegion).toHaveTextContent(/CHF\s*15\.00/);
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 15_000);
});
