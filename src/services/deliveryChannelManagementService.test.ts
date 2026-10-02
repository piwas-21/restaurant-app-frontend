import { apiClient, ApiError } from '@/utils/apiClient';
import {
  deliveryChannelManagementService,
  classifyDeliveryChannelMutationFailure,
  isDeliveryChannelModuleDisabled,
  isSafeUberAuthorizationUrl,
} from './deliveryChannelManagementService';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual<typeof import('@/utils/apiClient')>('@/utils/apiClient');
  return {
    ...actual,
    apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  };
});

const get = jest.mocked(apiClient.get);
const post = jest.mocked(apiClient.post);
const put = jest.mocked(apiClient.put);

beforeEach(() => jest.clearAllMocks());

describe('deliveryChannelManagementService', () => {
  it('reads the tenant-bound summary with human authentication', async () => {
    get.mockResolvedValue({} as never);

    await deliveryChannelManagementService.getSummary();

    expect(get).toHaveBeenCalledWith('/api/delivery-channels/management/uber', { requireAuth: true });
  });

  it('keeps Uber order acceptance opt-in in the OAuth request', async () => {
    post.mockResolvedValue({} as never);
    await deliveryChannelManagementService.startOAuth(false);
    await deliveryChannelManagementService.startOAuth(true);

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/delivery-channels/management/uber/oauth/start',
      { enableOrderAcceptance: false },
      { requireAuth: true },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/delivery-channels/management/uber/oauth/start',
      { enableOrderAcceptance: true },
      { requireAuth: true },
    );
  });

  it('uses the provider-language catalogue search and opaque cursor query', async () => {
    get.mockResolvedValue({} as never);

    await deliveryChannelManagementService.getCandidates('soup & salad', 'cursor/next');

    expect(get).toHaveBeenCalledWith(
      '/api/delivery-channels/management/uber/catalogue/candidates?search=soup+%26+salad&cursor=cursor%2Fnext',
      { requireAuth: true },
    );
  });

  it('sends a full replacement draft with its optimistic revision', async () => {
    put.mockResolvedValue({} as never);
    const draft = {
      expectedDraftRevision: 'draft-a',
      items: [{ providerItemId: 'uber-item', productId: 'product-a', variationId: null }],
    };

    await deliveryChannelManagementService.saveDraft(draft);

    expect(put).toHaveBeenCalledWith('/api/delivery-channels/management/uber/catalogue/draft', draft, {
      requireAuth: true,
    });
  });

  it('publishes only the reviewed immutable revision', async () => {
    post.mockResolvedValue({} as never);
    const request = { draftRevision: 'draft-a', publicationRevision: 'revision-a' };
    await deliveryChannelManagementService.publish(request);

    expect(post).toHaveBeenCalledWith('/api/delivery-channels/management/uber/catalogue/publish', request, {
      requireAuth: true,
    });
  });
});

describe('delivery-channel failure classification', () => {
  it('distinguishes stale, definitely rejected and ambiguous writes', () => {
    expect(classifyDeliveryChannelMutationFailure(new ApiError(409, ''))).toBe('stale');
    expect(classifyDeliveryChannelMutationFailure(new ApiError(400, ''))).toBe('rejected');
    expect(classifyDeliveryChannelMutationFailure(new ApiError(503, ''))).toBe('uncertain');
    expect(classifyDeliveryChannelMutationFailure(new ApiError(0, ''))).toBe('uncertain');
  });

  it('recognizes only the explicit deployment module refusal', () => {
    expect(isDeliveryChannelModuleDisabled(new ApiError(404, '', undefined, 'ModuleNotEnabled'))).toBe(true);
    expect(isDeliveryChannelModuleDisabled(new ApiError(404, '', undefined, 'NotFound'))).toBe(false);
  });

  it('accepts only HTTPS authorization links hosted on an Uber-controlled domain', () => {
    expect(isSafeUberAuthorizationUrl('https://auth.uber.com/oauth/authorize?state=opaque')).toBe(true);
    expect(isSafeUberAuthorizationUrl('http://auth.uber.com/oauth/authorize')).toBe(false);
    expect(isSafeUberAuthorizationUrl('https://uber.com.attacker.example/oauth/authorize')).toBe(false);
    expect(isSafeUberAuthorizationUrl('javascript:alert(1)')).toBe(false);
  });
});
