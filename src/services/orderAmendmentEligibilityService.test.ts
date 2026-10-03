import { apiClient } from '@/utils/apiClient';
import { getOrderAmendmentEligibility } from './orderAmendmentEligibilityService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));
const ORDER = '00000000-0000-4000-8000-000000000001';
const eligible = {
  orderId: ORDER,
  orderVersion: 7,
  accountRevision: null,
  canCreateAmendment: true,
  amendmentMode: 'Native',
  reasonCode: null,
};

describe('authoritative native amendment eligibility', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each(['Native', 'LocalSupplementOnly'])(
    'accepts the server mode %s and preserves login on a refusal',
    async (mode) => {
      jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: { ...eligible, amendmentMode: mode } });
      expect((await getOrderAmendmentEligibility(ORDER)).amendmentMode).toBe(mode);
      expect(apiClient.get).toHaveBeenCalledWith(`/api/staff/orders/${ORDER}/amendments/eligibility`, {
        requireAuth: true,
        signOutOn401: false,
      });
    },
  );
  it('accepts an explicit held result without making it actionable', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: {
        ...eligible,
        canCreateAmendment: false,
        amendmentMode: 'None',
        reasonCode: 'financialResolutionPending',
      },
    });
    expect((await getOrderAmendmentEligibility(ORDER)).canCreateAmendment).toBe(false);
  });
  it.each([
    ['wrong order', { ...eligible, orderId: '00000000-0000-4000-8000-000000000002' }],
    ['missing account revision', { ...eligible, accountRevision: undefined }],
    ['unsafe version', { ...eligible, orderVersion: 0 }],
    ['unknown mode', { ...eligible, amendmentMode: 'ProviderEdit' }],
    ['conflicting permission', { ...eligible, amendmentMode: 'None' }],
    ['unexplained refusal', { ...eligible, canCreateAmendment: false, amendmentMode: 'None' }],
    ['unknown reason', { ...eligible, canCreateAmendment: false, amendmentMode: 'None', reasonCode: 'unknown' }],
  ])('rejects %s before showing an amendment action', async (_label, data) => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data });
    await expect(getOrderAmendmentEligibility(ORDER)).rejects.toThrow();
  });
});
