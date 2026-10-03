import { apiClient } from '@/utils/apiClient';
import {
  pendingResolutionFixture,
  resolutionIds,
  resolutionResultFixture,
} from '@/lib/__fixtures__/amendmentResolution';
import { getAmendmentResolutionRecovery, listAmendmentResolutionRecovery } from './amendmentResolutionRecoveryService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const get = jest.mocked(apiClient.get);
function recovery() {
  const pending = pendingResolutionFixture();
  const result = resolutionResultFixture();
  return {
    originalRequest: pending.request,
    reviewedQuote: pending.reviewedQuote,
    result: {
      ...result,
      state: 'ReconciliationRequired',
      resolvedAt: null,
      refundLegs: result.refundLegs.map((leg) => ({ ...leg, state: 'ReconciliationRequired', resolvedAt: null })),
    },
  };
}
describe('owner-only amendment recovery wire validation', () => {
  beforeEach(() => jest.clearAllMocks());
  it('binds the original request, quote and accepted operation using only an authenticated GET', async () => {
    const value = recovery();
    get.mockResolvedValue({ success: true, data: value });
    const recovered = await getAmendmentResolutionRecovery(
      resolutionIds.actor,
      resolutionIds.order,
      resolutionIds.amendment,
    );
    expect(recovered.pending).toMatchObject({
      actorId: resolutionIds.actor,
      operationId: resolutionIds.operation,
      request: value.originalRequest,
    });
    expect(recovered.result).toEqual(value.result);
    expect(get).toHaveBeenCalledWith(
      `/api/staff/orders/${resolutionIds.order}/amendments/${resolutionIds.amendment}/financial-resolution/recovery`,
      { requireAuth: true, signOutOn401: false },
    );
    expect(apiClient.post).not.toHaveBeenCalled();
  });
  it('accepts an affirmative empty order list and preserves the original key for an unresolved list', async () => {
    get.mockResolvedValueOnce({ success: true, data: [] }).mockResolvedValueOnce({ success: true, data: [recovery()] });
    await expect(listAmendmentResolutionRecovery(resolutionIds.actor, resolutionIds.order)).resolves.toEqual([]);
    const values = await listAmendmentResolutionRecovery(resolutionIds.actor, resolutionIds.order);
    expect(values[0].pending.request.quote.clientOperationId).toBe(resolutionIds.client);
    expect(get).toHaveBeenLastCalledWith(
      `/api/staff/orders/${resolutionIds.order}/amendment-financial-resolution-recovery`,
      { requireAuth: true, signOutOn401: false },
    );
  });
  it.each(['order', 'amendment', 'hash', 'money', 'client', 'legacy', 'providerLeak'] as const)(
    'holds %s mismatches',
    async (defect) => {
      const value = recovery();
      const damaged: Record<typeof defect, unknown> = {
        order: { ...value, reviewedQuote: { ...value.reviewedQuote, orderId: resolutionIds.other } },
        amendment: { ...value, result: { ...value.result, amendmentId: resolutionIds.other } },
        hash: { ...value, originalRequest: { ...value.originalRequest, quoteHash: 'b'.repeat(64) } },
        money: { ...value, result: { ...value.result, creditMinor: 999 } },
        client: { ...value, result: { ...value.result, clientOperationId: resolutionIds.other } },
        legacy: { reviewedQuote: value.reviewedQuote, result: value.result },
        providerLeak: { ...value, providerCredential: 'must-not-reach-ui' },
      };
      get.mockResolvedValue({ success: true, data: damaged[defect] });
      await expect(
        getAmendmentResolutionRecovery(resolutionIds.actor, resolutionIds.order, resolutionIds.amendment),
      ).rejects.toThrow();
      expect(apiClient.post).not.toHaveBeenCalled();
    },
  );
  it.each(['ambiguous', 'resolved', 'missing', 'failed'])('does not treat %s inventory as empty', async (defect) => {
    const value = recovery();
    get.mockResolvedValue(
      defect === 'failed'
        ? { success: false, data: [] }
        : defect === 'missing'
          ? { success: true }
          : {
              success: true,
              data: defect === 'ambiguous' ? [value, value] : [{ ...value, result: resolutionResultFixture() }],
            },
    );
    await expect(listAmendmentResolutionRecovery(resolutionIds.actor, resolutionIds.order)).rejects.toThrow();
  });
  it('propagates lookup failure without clearing or making a provider-capable request', async () => {
    get.mockRejectedValue(new Error('404'));
    await expect(listAmendmentResolutionRecovery(resolutionIds.actor, resolutionIds.order)).rejects.toThrow();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
