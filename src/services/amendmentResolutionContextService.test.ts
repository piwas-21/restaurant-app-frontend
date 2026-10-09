import { apiClient } from '@/utils/apiClient';
import { getAmendmentResolutionContext } from './amendmentResolutionContextService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));
const ORDER = '00000000-0000-4000-8000-000000000001';
const AMENDMENT = '00000000-0000-4000-8000-000000000002';
const PAYMENT = '00000000-0000-4000-8000-000000000003';
const context = {
  orderId: ORDER,
  amendmentId: AMENDMENT,
  expectedOrderVersion: 7,
  expectedAccountRevision: 9,
  currency: 'CHF',
  creditMinor: 1000,
  earningRetirementRequired: false,
  manualRefundCandidates: [{ paymentId: PAYMENT, paymentMethod: 'Cash', availableMinor: 450 }],
};

describe('authoritative amendment refund review context', () => {
  beforeEach(() => jest.clearAllMocks());
  it('reads the exact context without signing the actor out on a refusal', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: context });
    await expect(
      getAmendmentResolutionContext(ORDER, AMENDMENT, { currency: 'chf', creditMinor: 1000 }),
    ).resolves.toEqual(context);
    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/staff/orders/${ORDER}/amendments/${AMENDMENT}/financial-resolution/context`,
      { requireAuth: true, signOutOn401: false },
    );
  });
  it.each([
    ['wrong order', { ...context, orderId: PAYMENT }],
    ['wrong amendment', { ...context, amendmentId: PAYMENT }],
    ['wrong currency', { ...context, currency: 'EUR' }],
    ['wrong frozen credit', { ...context, creditMinor: 999 }],
    ['missing account revision', { ...context, expectedAccountRevision: undefined }],
    ['unsafe version', { ...context, expectedOrderVersion: 0 }],
    ['unsafe account revision', { ...context, expectedAccountRevision: Number.MAX_SAFE_INTEGER + 1 }],
    [
      'duplicate payment',
      { ...context, manualRefundCandidates: [...context.manualRefundCandidates, ...context.manualRefundCandidates] },
    ],
    [
      'online tender as manual candidate',
      {
        ...context,
        manualRefundCandidates: [{ paymentId: PAYMENT, paymentMethod: 'OnlinePayment', availableMinor: 400 }],
      },
    ],
  ])('refuses %s before a quote can use it', async (_label, value) => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: value });
    await expect(
      getAmendmentResolutionContext(ORDER, AMENDMENT, { currency: 'CHF', creditMinor: 1000 }),
    ).rejects.toThrow();
  });
  it('refuses an unsuccessful envelope even with otherwise valid data', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: false, data: context });
    await expect(getAmendmentResolutionContext(ORDER, AMENDMENT)).rejects.toThrow();
  });
  it('keeps older context responses usable when the additive retirement flag is absent', async () => {
    const olderContext = { ...context };
    Reflect.deleteProperty(olderContext, 'earningRetirementRequired');
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: olderContext });
    await expect(getAmendmentResolutionContext(ORDER, AMENDMENT)).resolves.toMatchObject({
      earningRetirementRequired: false,
      expectedOrderVersion: 7,
    });
  });
});
