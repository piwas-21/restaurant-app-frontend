import { apiClient } from '@/utils/apiClient';
import { prepareAmendmentEarningRetirement } from './amendmentEarningRetirementService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { post: jest.fn() } }));

const ORDER = '00000000-0000-4000-8000-000000000001';
const AMENDMENT = '00000000-0000-4000-8000-000000000002';
const context = {
  earningRetirementRequired: true,
  expectedOrderVersion: 7,
  expectedAccountRevision: 9,
};

describe('explicit legacy earning retirement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the fresh server-owned order and visit versions to the Admin endpoint', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: { orderId: ORDER, amendmentId: AMENDMENT, state: 'Retired' },
    });

    await expect(prepareAmendmentEarningRetirement(ORDER, AMENDMENT, context)).resolves.toBeUndefined();

    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/staff/orders/${ORDER}/amendments/${AMENDMENT}/financial-resolution/prepare-earning-retirement`,
      { expectedOrderVersion: 7, expectedAccountRevision: 9 },
      { requireAuth: true, signOutOn401: false },
    );
  });

  it('preserves a null service-session revision when the context has no visit', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: { orderId: ORDER, amendmentId: AMENDMENT, state: 'Retired' },
    });

    await prepareAmendmentEarningRetirement(ORDER, AMENDMENT, {
      ...context,
      expectedAccountRevision: null,
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      expect.any(String),
      { expectedOrderVersion: 7, expectedAccountRevision: null },
      expect.any(Object),
    );
  });

  it('does not call the server when the fresh context does not require retirement', async () => {
    await expect(
      prepareAmendmentEarningRetirement(ORDER, AMENDMENT, { ...context, earningRetirementRequired: false }),
    ).rejects.toThrow('EarningRetirementNotRequired');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each([
    ['unsuccessful response', { success: false, data: { orderId: ORDER, amendmentId: AMENDMENT, state: 'Retired' } }],
    ['wrong order', { success: true, data: { orderId: AMENDMENT, amendmentId: AMENDMENT, state: 'Retired' } }],
    ['wrong amendment', { success: true, data: { orderId: ORDER, amendmentId: ORDER, state: 'Retired' } }],
    ['wrong state', { success: true, data: { orderId: ORDER, amendmentId: AMENDMENT, state: 'Pending' } }],
  ])('rejects %s rather than treating it as retired', async (_label, response) => {
    jest.mocked(apiClient.post).mockResolvedValue(response);
    await expect(prepareAmendmentEarningRetirement(ORDER, AMENDMENT, context)).rejects.toThrow();
  });
});
