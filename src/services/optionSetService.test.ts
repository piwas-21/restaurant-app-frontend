import {
  applyOptionSetAttachments,
  createOptionSet,
  getOptionSet,
  getOptionSetMaterializationEnabled,
  previewOptionSetAttachments,
  searchOptionSets,
  updateOptionSet,
} from './optionSetService';
import { apiClient } from '@/utils/apiClient';
import type { OptionSetDetail } from '@/types/optionSet';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient') as typeof import('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() } };
});

const detail: OptionSetDetail = {
  id: 'set-1',
  kind: 'bundleChoice',
  name: 'Taco fillings',
  sourceLocale: 'en',
  translations: { en: 'Taco fillings' },
  status: 'active',
  version: 2,
  entryCount: 1,
  attachmentCount: 0,
  entries: [],
  attachments: [],
};

beforeEach(() => jest.clearAllMocks());

describe('optionSetService', () => {
  it('sends bounded cursor search filters and unwraps the API envelope', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: { items: [], nextCursor: null } });
    await expect(
      searchOptionSets({ kind: 'bundleChoice', query: ' taco ', cursor: 'next', limit: 24 }),
    ).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/api/OptionSets?kind=bundleChoice&q=taco&cursor=next&limit=24', {
      requireAuth: true,
    });
  });

  it('loads and creates a detail DTO through the wrapped API', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: detail });
    jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: detail });
    await expect(getOptionSet('set-1')).resolves.toEqual(detail);
    await expect(
      createOptionSet({
        kind: 'bundleChoice',
        name: 'Taco fillings',
        sourceLocale: 'en',
        translations: { en: 'Taco fillings' },
        entries: [],
      }),
    ).resolves.toEqual(detail);
    expect(apiClient.get).toHaveBeenCalledWith('/api/OptionSets/set-1', { requireAuth: true });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/OptionSets',
      {
        kind: 'bundleChoice',
        name: 'Taco fillings',
        sourceLocale: 'en',
        translations: { en: 'Taco fillings' },
        entries: [],
      },
      { requireAuth: true },
    );
  });

  it('uses the DTO version as the required If-Match ETag', async () => {
    jest.mocked(apiClient.put).mockResolvedValue({ success: true, data: detail });
    await updateOptionSet('set-1', 2, {
      kind: 'bundleChoice',
      name: 'Taco fillings',
      sourceLocale: 'en',
      translations: { en: 'Taco fillings' },
      entries: [],
    });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/OptionSets/set-1',
      {
        kind: 'bundleChoice',
        name: 'Taco fillings',
        sourceLocale: 'en',
        translations: { en: 'Taco fillings' },
        entries: [],
      },
      { requireAuth: true, headers: { 'If-Match': '"2"' } },
    );
  });

  it('preserves the server refusal for callers to display', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: false,
      message: 'Option sets are unavailable',
      errors: ['Try again shortly'],
      errorCode: 'OptionSetUnavailable',
    });
    await expect(searchOptionSets()).rejects.toMatchObject({
      message: 'Option sets are unavailable',
      errors: ['Try again shortly'],
      errorCode: 'OptionSetUnavailable',
    });
  });

  it('uses only the confirmed target list for preview and apply', async () => {
    const request = {
      expectedSetVersion: 2,
      idempotencyKey: 'stable-key',
      targets: [
        {
          targetKey: 'productChoice:product-1:group-1',
          role: 'productChoice',
          targetProductId: 'product-1',
          targetCustomizationGroupId: 'group-1',
          expectedCustomizationGroupVersion: 3,
          expectedAttachmentVersion: null,
          conflictPolicy: 'preserveLocal',
        },
      ],
    } as const;
    jest
      .mocked(apiClient.post)
      .mockResolvedValue({ success: true, data: { optionSetId: 'set-1', setVersion: 2, targets: [] } });
    await previewOptionSetAttachments('set-1', request);
    await applyOptionSetAttachments('set-1', request);
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/api/OptionSets/set-1/preview', request, { requireAuth: true });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/api/OptionSets/set-1/apply', request, { requireAuth: true });
  });

  it('fails closed when the tenant feature is not enabled', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: { optionSetMaterializationEnabled: false } });
    await expect(getOptionSetMaterializationEnabled()).resolves.toBe(false);
    expect(apiClient.get).toHaveBeenCalledWith('/api/tenant/features', { requireAuth: true });
  });
});
