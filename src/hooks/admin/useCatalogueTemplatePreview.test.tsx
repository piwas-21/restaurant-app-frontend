import { renderHook, waitFor } from '@testing-library/react';
import { CATALOGUE_PREVIEW_DEPENDENCY_CONCURRENCY, CATALOGUE_PREVIEW_MAX_DEPENDENCIES } from '@/config/catalogue';
import {
  getCatalogueTemplateRevision,
  type CatalogueTemplateDependency,
  type CatalogueTemplateRevision,
  type CatalogueTemplateSummary,
} from '@/services/catalogueTemplateService';
import { useCatalogueTemplatePreview } from './useCatalogueTemplatePreview';

jest.mock('@/services/catalogueTemplateService', () => ({
  ...jest.requireActual('@/services/catalogueTemplateService'),
  getCatalogueTemplateRevision: jest.fn(),
}));

const summary: CatalogueTemplateSummary = {
  templateId: 'root-template',
  revision: 1,
  type: 'category',
  cuisines: [],
  displayName: 'Root',
  sourceLocale: 'en',
  displayLocale: 'en',
  usedSourceFallback: false,
  reviewedTranslationLocales: [],
  dependencyCount: 0,
  compatibleTenantContractVersions: [1],
};

function revision(
  templateId: string,
  revisionNumber: number,
  dependencies: CatalogueTemplateDependency[] = [],
): CatalogueTemplateRevision {
  return {
    schemaVersion: 1,
    templateId,
    revision: revisionNumber,
    type: 'category',
    cuisines: [],
    name: templateId,
    description: null,
    sourceLocale: 'en',
    translations: {},
    localeFallbacks: [],
    dependencies,
    provenance: {
      contentOrigin: 'sofra-original',
      sourceDescription: 'Sofra original',
      license: 'Sofra catalogue terms',
      mediaAssets: [],
    },
    qualityStatus: 'reviewed',
    compatibleTenantContractVersions: [1],
    contentHash: `${templateId}-${revisionNumber}`,
    payload: { sortOrder: 0 },
  };
}

describe('useCatalogueTemplatePreview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deduplicates exact revision refs and bounds dependency requests and concurrency', async () => {
    const dependencies = Array.from({ length: CATALOGUE_PREVIEW_MAX_DEPENDENCIES + 6 }, (_, index) => ({
      templateId: `dependency-${index}`,
      revision: 1,
      role: 'ingredient' as const,
    }));
    dependencies.push(dependencies[0], dependencies[0]);
    const root = revision(summary.templateId, summary.revision, dependencies);
    let activeRequests = 0;
    let peakConcurrency = 0;
    (getCatalogueTemplateRevision as jest.Mock).mockImplementation(
      async (templateId: string, exactRevision: number) => {
        if (templateId === summary.templateId) return root;
        activeRequests += 1;
        peakConcurrency = Math.max(peakConcurrency, activeRequests);
        await Promise.resolve();
        activeRequests -= 1;
        if (templateId === 'dependency-0') throw new Error('dependency offline');
        return revision(templateId, exactRevision);
      },
    );

    const { result } = renderHook(() => useCatalogueTemplatePreview(summary));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const dependencyCalls = (getCatalogueTemplateRevision as jest.Mock).mock.calls
      .map(([templateId]) => templateId as string)
      .filter((templateId) => templateId !== summary.templateId);
    expect(dependencyCalls).toHaveLength(CATALOGUE_PREVIEW_MAX_DEPENDENCIES);
    expect(new Set(dependencyCalls).size).toBe(CATALOGUE_PREVIEW_MAX_DEPENDENCIES);
    expect(peakConcurrency).toBeGreaterThan(1);
    expect(peakConcurrency).toBeLessThanOrEqual(CATALOGUE_PREVIEW_DEPENDENCY_CONCURRENCY);
    expect(result.current.unresolvedDependencyCount).toBe(1);
    expect(result.current.truncatedDependencyCount).toBe(6);
  });
});
