import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { apiClient } from '@/utils/apiClient';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import {
  createGuestAccountPaymentDescriptor,
  withCheckoutAttempt,
  withQuotedOperation,
} from './guestAccountPaymentStorage';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import {
  createGuestEqualSharePlan,
  getGuestAccountPaymentOperation,
  getGuestEqualSharePlan,
  getGuestPaymentReceipt,
  startGuestCheckout,
} from './guestAccountPaymentService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const identity: TableGuestVisitIdentity = {
  serviceSessionId: '00000000-0000-4000-8000-000000000001',
  participantToken: 'participant-credential',
  expiresAt: '2030-01-01T00:00:00Z',
};
const receiptCredential = 'A'.repeat(43);
const attemptId = '00000000-0000-4000-8000-000000000020';
const operationId = '00000000-0000-4000-8000-000000000010';
const ORDER_ID = '00000000-0000-4000-8000-000000000030';

async function descriptor() {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
  const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
  if (!participantFingerprint) throw new Error('participant fingerprint is unavailable');
  return withCheckoutAttempt(
    withQuotedOperation(
      createGuestAccountPaymentDescriptor(
        identity.serviceSessionId,
        operationId,
        {
          expectedAccountRevision: 3,
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        },
        participantFingerprint,
      ),
      1,
      { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'a'.repeat(64) },
    ),
    attemptId,
  );
}

describe('guest account payment service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts checkout using participant plus receipt headers, without body or URL credential leakage', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: {
        attemptId,
        operationId: '00000000-0000-4000-8000-000000000010',
        state: 'Starting',
        version: 1,
        amountMinor: 1250,
        currency: 'CHF',
        expiresAt: '2030-01-01T00:10:00Z',
        checkoutUrl: null,
        reconciliationRequired: false,
        receivedMinor: 0,
        refundedMinor: 0,
      },
    });

    await startGuestCheckout(identity, await descriptor(), 9, receiptCredential);

    const [url, body, config] = jest.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe(
      `/api/table-guest-visits/${identity.serviceSessionId}/account-payments/operations/${operationId}/checkout`,
    );
    expect(body).toEqual({ expectedVersion: 9 });
    expect(JSON.stringify({ url, body })).not.toContain(receiptCredential);
    expect(config).toMatchObject({
      cache: 'no-store',
      skipAuth: true,
      skipSession: true,
      signOutOn401: false,
      headers: {
        'X-Table-Participant': identity.participantToken,
        'X-Account-Payment-Receipt': receiptCredential,
      },
    });
  });

  it('reads the private receipt using only its short-lived receipt capability header', async () => {
    const abortController = new AbortController();
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: {
        attemptId,
        amountMinor: 1250,
        currency: 'CHF',
        state: 'Captured',
        receivedMinor: 1250,
        refundedMinor: 0,
        reconciliationRequired: false,
        completedAt: '2030-01-01T00:00:00Z',
        receiptExpiresAt: '2030-01-04T00:00:00Z',
      },
    });

    const result = await getGuestPaymentReceipt(
      attemptId,
      receiptCredential,
      await descriptor(),
      abortController.signal,
    );

    expect(result.attemptId).toBe(attemptId);
    expect(jest.mocked(apiClient.get)).toHaveBeenCalledWith(
      `/api/account-payment-receipts/${attemptId}`,
      expect.objectContaining({
        cache: 'no-store',
        skipAuth: true,
        skipSession: true,
        signOutOn401: false,
        headers: { 'X-Account-Payment-Receipt': receiptCredential },
        signal: abortController.signal,
      }),
    );
  });

  it('looks up the original guest equal-share operation with participant authority only', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: {
        serviceSessionId: identity.serviceSessionId,
        planId: '00000000-0000-4000-8000-000000000030',
        operationId: '00000000-0000-4000-8000-000000000010',
        accountRevision: 3,
        totalMinor: 5000,
        shareCount: 2,
        currency: 'CHF',
        createdAt: '2030-01-01T00:00:00Z',
        invalidatedAt: null,
        scope: [
          {
            orderId: ORDER_ID,
            orderItemId: null,
            startOrdinal: 1,
            unitCount: 1,
            minorPerUnit: 5000,
            amountMinor: 5000,
          },
        ],
      },
    });

    const plan = await getGuestEqualSharePlan(identity, '00000000-0000-4000-8000-000000000010');

    expect(plan.operationId).toBe('00000000-0000-4000-8000-000000000010');
    expect(jest.mocked(apiClient.get)).toHaveBeenCalledWith(
      `/api/table-guest-visits/${identity.serviceSessionId}/account-payments/equal-share-plans/operations/00000000-0000-4000-8000-000000000010`,
      expect.objectContaining({
        cache: 'no-store',
        skipAuth: true,
        skipSession: true,
        signOutOn401: false,
        headers: { 'X-Table-Participant': identity.participantToken },
      }),
    );
  });

  it.each([
    ['another visit', { serviceSessionId: '00000000-0000-4000-8000-000000000099' }],
    ['another operation', { operationId: '00000000-0000-4000-8000-000000000099' }],
    ['different account revision', { accountRevision: 4 }],
    ['an invalid currency', { currency: 'CHF1' }],
    ['an inconsistent scope', { scope: [] }],
  ])(
    'rejects equal-share plan response with %s before caller can retire its saved intent',
    async (_label, override) => {
      jest.mocked(apiClient.post).mockResolvedValue({
        success: true,
        data: {
          serviceSessionId: identity.serviceSessionId,
          planId: '00000000-0000-4000-8000-000000000030',
          operationId,
          accountRevision: 3,
          totalMinor: 5000,
          shareCount: 2,
          currency: 'CHF',
          createdAt: '2030-01-01T00:00:00Z',
          invalidatedAt: null,
          scope: [
            {
              orderId: ORDER_ID,
              orderItemId: null,
              startOrdinal: 1,
              unitCount: 1,
              minorPerUnit: 5000,
              amountMinor: 5000,
            },
          ],
          ...override,
        },
      });
      await expect(
        createGuestEqualSharePlan(identity, {
          operationId,
          expectedAccountRevision: 3,
          shareCount: 2,
        }),
      ).rejects.toThrow();
    },
  );

  it('refuses to send a saved operation under another same-visit participant', async () => {
    const saved = await descriptor();
    await expect(
      getGuestAccountPaymentOperation({ ...identity, participantToken: 'another-participant' }, saved),
    ).rejects.toThrow(/another participant or visit/);
    await expect(
      startGuestCheckout({ ...identity, participantToken: 'another-participant' }, saved, 9, receiptCredential),
    ).rejects.toThrow(/another participant or visit/);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
