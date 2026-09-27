import {
  getCatalogueTemplateRevision,
  listCatalogueTemplates,
  resolveCatalogueTemplateText,
  type CatalogueTemplateRevision,
} from './catalogueTemplateService';
import { apiClient } from '@/utils/apiClient';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));

describe('catalogueTemplateService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps search filters, locale, cursor, and page size on the same-origin list route', async () => {
    const signal = new AbortController().signal;
    const response = { items: [], nextCursor: null };
    (apiClient.get as jest.Mock).mockResolvedValueOnce(response);

    await expect(
      listCatalogueTemplates(
        { type: 'cuisine-pack', cuisine: 'turkish', q: 'grill & kebab', locale: 'fr', cursor: 'page+2', limit: 24 },
        signal,
      ),
    ).resolves.toBe(response);

    const [path, config] = (apiClient.get as jest.Mock).mock.calls[0];
    expect(path).toBe(
      '/api/catalogue/templates?locale=fr&limit=24&type=cuisine-pack&cuisine=turkish&q=grill+%26+kebab&cursor=page%2B2',
    );
    expect(config).toEqual({ signal });
  });

  it('requests an immutable exact revision by encoded template id', async () => {
    const response = { templateId: 'turkish-grill-set', revision: 3 };
    (apiClient.get as jest.Mock).mockResolvedValueOnce(response);

    await expect(getCatalogueTemplateRevision('turkish-grill-set', 3)).resolves.toBe(response);

    expect(apiClient.get).toHaveBeenCalledWith('/api/catalogue/templates/turkish-grill-set/revisions/3', undefined);
  });

  it('clamps list page sizes to a bounded server request', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });

    await listCatalogueTemplates({ locale: 'en', limit: 1000 });
    await listCatalogueTemplates({ locale: 'en', limit: 0 });

    expect((apiClient.get as jest.Mock).mock.calls[0][0]).toContain('limit=24');
    expect((apiClient.get as jest.Mock).mock.calls[1][0]).toContain('limit=1');
  });

  it('resolves translated fields through declared locale fallbacks before canonical copy', () => {
    const detail: CatalogueTemplateRevision = {
      schemaVersion: 1,
      templateId: 'lentil-soup',
      revision: 2,
      type: 'ingredient',
      cuisines: ['turkish'],
      name: 'Mercimek çorbası',
      description: null,
      sourceLocale: 'tr',
      translations: { fr: { name: 'Soupe de lentilles' }, en: { name: 'Lentil soup', description: 'A warm soup.' } },
      localeFallbacks: ['en'],
      dependencies: [],
      provenance: {
        contentOrigin: 'sofra-original',
        sourceDescription: 'Sofra original.',
        license: 'Sofra catalogue terms',
        mediaAssets: [],
      },
      qualityStatus: 'reviewed',
      compatibleTenantContractVersions: [1],
      contentHash: 'hash',
      payload: { suggestedOnly: true, role: 'soup' },
    };

    expect(resolveCatalogueTemplateText(detail, 'fr')).toEqual({
      name: 'Soupe de lentilles',
      description: 'A warm soup.',
    });
  });
});
