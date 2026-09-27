import { renderHook, waitFor } from '@testing-library/react';
import { getCatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import type { CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import type { CatalogueImportSessionItem } from '@/services/catalogueImportService';
import { useCatalogueOptionPrices } from './useCatalogueOptionPrices';

jest.mock('@/services/catalogueTemplateService', () => ({
  ...jest.requireActual('@/services/catalogueTemplateService'),
  getCatalogueTemplateRevision: jest.fn(),
}));

const revision = (
  templateId: string,
  type: CatalogueTemplateRevision['type'],
  payload: CatalogueTemplateRevision['payload'],
  revisionNumber = 1,
): CatalogueTemplateRevision =>
  ({
    schemaVersion: 1,
    templateId,
    revision: revisionNumber,
    type,
    cuisines: ['test'],
    name: templateId,
    description: null,
    sourceLocale: 'en',
    translations: {},
    localeFallbacks: ['en'],
    dependencies: [],
    provenance: {
      contentOrigin: 'sofra-original',
      sourceDescription: 'Reviewed source',
      license: 'Terms',
      mediaAssets: [],
    },
    qualityStatus: 'reviewed',
    compatibleTenantContractVersions: [1],
    contentHash: `${templateId}-hash`,
    payload,
  }) as CatalogueTemplateRevision;

const sessionItem = (templateId: string, type: CatalogueImportSessionItem['type']): CatalogueImportSessionItem => ({
  templateId,
  revision: 1,
  type,
  displayName: templateId,
  description: null,
  contentHash: `${templateId}-hash`,
  isRoot: false,
  isSelectable: false,
  isSelected: true,
  selectionRole: 'dependency',
  status: 'Pending',
  localEntityType: null,
  localEntityId: null,
  failureCode: null,
  decision: null,
});

describe('useCatalogueOptionPrices', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads exact pinned choices with deduplicated references and no central prices', async () => {
    const bundle = revision('bundle', 'bundle', {
      sections: [
        {
          sectionKey: 'size',
          name: 'Size',
          sortOrder: 1,
          min: 1,
          max: 1,
          options: [{ templateId: 'choice', revision: 2, sortOrder: 1 }],
        },
      ],
      requiredLocalReviewFields: [],
    });
    const optionSet = revision('set', 'option-set', {
      kind: 'sauce',
      min: 0,
      max: 2,
      options: [{ templateId: 'choice', revision: 2, sortOrder: 1 }],
    });
    const choice = revision(
      'choice',
      'item',
      {
        suggestedIngredients: [],
        optionSets: [],
        sideSets: [],
        requiredLocalReviewFields: [],
      },
      2,
    );
    (getCatalogueTemplateRevision as jest.Mock).mockImplementation(
      async (id: string) => ({ bundle, set: optionSet, choice })[id],
    );

    const { result } = renderHook(() =>
      useCatalogueOptionPrices([sessionItem('bundle', 'bundle'), sessionItem('set', 'option-set')], 'en'),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getCatalogueTemplateRevision).toHaveBeenCalledTimes(3);
    expect(result.current.byOwner['bundle@1']).toEqual([{ key: 'choice@2', name: 'choice' }]);
    expect(result.current.byOwner['set@1']).toEqual([{ key: 'choice@2', name: 'choice' }]);
    expect(result.current.byOwner['bundle@1'][0]).not.toHaveProperty('price');
    expect(result.current.error).toBeNull();
  });
});
