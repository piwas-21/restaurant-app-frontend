import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import { createGuestAccountPaymentDescriptor } from '@/services/guestAccountPaymentStorage';
import type { GuestAccountPaymentOperation } from '@/types/guestAccountPayments';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import { apiClient } from '@/utils/apiClient';
import { retryGuestAccountPaymentQuote } from './guestAccountPaymentQuoteRetryService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { post: jest.fn() } }));

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000010';
const ORDER_ID = '00000000-0000-4000-8000-000000000030';
const identity: TableGuestVisitIdentity = {
  serviceSessionId: SESSION_ID,
  participantToken: 'participant-secret',
  expiresAt: '2030-01-01T00:00:00Z',
};
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalTextEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');

function quotedOperation(): GuestAccountPaymentOperation {
  return {
    serviceSessionId: SESSION_ID,
    operationId: OPERATION_ID,
    state: 'Quoted',
    version: 1,
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'OnlinePayment',
    amountMinor: 1250,
    currency: 'CHF',
    quoteExpiresAt: '2030-01-01T00:10:00Z',
    reservedAt: null,
    reservationExpiresAt: null,
    equalSharePlanId: null,
    equalShareOrdinal: null,
    allocations: [
      { orderId: ORDER_ID, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 1250, amountMinor: 1250 },
    ],
  };
}

describe('retryGuestAccountPaymentQuote', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
    if (originalTextEncoder) Object.defineProperty(globalThis, 'TextEncoder', originalTextEncoder);
    else Reflect.deleteProperty(globalThis, 'TextEncoder');
  });

  it('replays the exact saved quote operation without requiring current allocations to match', async () => {
    const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
    const descriptor = createGuestAccountPaymentDescriptor(
      SESSION_ID,
      OPERATION_ID,
      { expectedAccountRevision: 7, mode: 'Amount', paymentMethod: 'OnlinePayment', amountMinor: 1250 },
      participantFingerprint,
    );
    jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: quotedOperation() });

    const result = await retryGuestAccountPaymentQuote(identity, descriptor, 'CHF');

    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/table-guest-visits/${SESSION_ID}/account-payments/quotes`,
      {
        operationId: OPERATION_ID,
        expectedAccountRevision: 7,
        mode: 'Amount',
        paymentMethod: 'OnlinePayment',
        amountMinor: 1250,
      },
      {
        headers: { 'X-Table-Participant': identity.participantToken },
        cache: 'no-store',
        skipAuth: true,
        skipSession: true,
        signOutOn401: false,
      },
    );
    expect(result.operation).toMatchObject({ operationId: OPERATION_ID, state: 'Quoted', amountMinor: 1250 });
    expect(result.contribution).toMatchObject({ amountMinor: 1250, currency: 'CHF' });
  });

  it('rejects a replay whose frozen currency differs from the active visit', async () => {
    const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
    const descriptor = createGuestAccountPaymentDescriptor(
      SESSION_ID,
      OPERATION_ID,
      { expectedAccountRevision: 7, mode: 'Amount', paymentMethod: 'OnlinePayment', amountMinor: 1250 },
      participantFingerprint,
    );
    jest.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: { ...quotedOperation(), currency: 'EUR' },
    });

    await expect(retryGuestAccountPaymentQuote(identity, descriptor, 'CHF')).rejects.toThrow();
  });
});
