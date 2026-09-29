import React from 'react';
import { render, screen } from '@testing-library/react';
import type { CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import CatalogueImportPreviewReview from './CatalogueImportPreviewReview';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('identifies the exact local record selected for reuse before import', () => {
  render(
    <CatalogueImportPreviewReview
      preview={{
        sessionId: 'session-1',
        version: 3,
        items: [
          {
            templateId: 'item-1',
            revision: 1,
            type: 'item',
            displayName: 'Ayran',
            isSelected: true,
            resolution: 'Reuse',
            localEntityId: 'local-ayran',
            localEntityName: 'Restaurant Ayran',
            candidates: [],
            warnings: [],
            blockingIssues: [],
          },
        ],
      }}
      locale="en"
      detailsByKey={{}}
      decisions={{}}
      canChooseCandidate={() => true}
      onChooseCandidate={jest.fn()}
    />,
  );
  expect(screen.getByText('local-ayran')).toBeInTheDocument();
  expect(screen.getByText(/Restaurant Ayran/)).toBeInTheDocument();
});

it('shows the first selected offer’s draft guest path in the import review', () => {
  const detail: CatalogueTemplateRevision = {
    schemaVersion: 1,
    templateId: 'bundle-1',
    revision: 1,
    type: 'bundle',
    cuisines: [],
    name: 'Tacos',
    description: null,
    sourceLocale: 'en',
    localeFallbacks: ['en'],
    translations: {},
    dependencies: [],
    provenance: {
      contentOrigin: 'sofra-original',
      sourceDescription: 'Reviewed source',
      license: 'Terms',
      mediaAssets: [],
    },
    qualityStatus: 'reviewed',
    compatibleTenantContractVersions: [1],
    contentHash: 'bundle-1-hash',
    payload: {
      sections: [{ sectionKey: 'meat', name: 'Meat', sortOrder: 0, min: 1, max: 1, options: [] }],
      requiredLocalReviewFields: [],
    },
  };
  render(
    <CatalogueImportPreviewReview
      preview={{
        sessionId: 'session-2',
        version: 1,
        items: [
          {
            templateId: 'bundle-1',
            revision: 1,
            type: 'bundle',
            displayName: 'Tacos',
            isSelected: true,
            resolution: 'Create',
            localEntityId: null,
            candidates: [],
            warnings: [],
            blockingIssues: [],
          },
        ],
      }}
      locale="en"
      detailsByKey={{ 'bundle-1@1': detail }}
      decisions={{ 'bundle-1@1': { templateId: 'bundle-1', revision: 1, resolution: 'Create', localPrice: 12 } }}
      canChooseCandidate={() => true}
      onChooseCandidate={jest.fn()}
    />,
  );

  expect(screen.getByText('Meat')).toBeInTheDocument();
  expect(screen.getByText('catalogue_import_draft_guest_notice')).toBeInTheDocument();
});

it('uses the mapped local option set for an unselected dependency', () => {
  const item: CatalogueTemplateRevision = {
    schemaVersion: 1,
    templateId: 'item',
    revision: 1,
    type: 'item',
    cuisines: [],
    name: 'Burger',
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
    contentHash: 'item-hash',
    payload: {
      suggestedIngredients: [],
      optionSets: [{ templateId: 'set', revision: 1 }],
      sideSets: [],
      requiredLocalReviewFields: [],
    },
  };
  const set: CatalogueTemplateRevision = {
    ...item,
    templateId: 'set',
    type: 'option-set',
    name: 'Template sauces',
    payload: { kind: 'sauce', min: 0, max: 2, options: [{ templateId: 'source-sauce', revision: 1, sortOrder: 0 }] },
  };
  render(
    <CatalogueImportPreviewReview
      preview={{
        sessionId: 'session-3',
        version: 1,
        items: [
          {
            templateId: 'item',
            revision: 1,
            type: 'item',
            displayName: 'Burger',
            isSelected: true,
            resolution: 'Create',
            localEntityId: null,
            candidates: [],
            warnings: [],
            blockingIssues: [],
          },
          {
            templateId: 'set',
            revision: 1,
            type: 'option-set',
            displayName: 'Template sauces',
            isSelected: false,
            resolution: 'Reuse',
            localEntityId: 'local-set',
            localEntityName: 'Tenant sauces',
            candidates: [],
            warnings: [],
            blockingIssues: [],
          },
        ],
      }}
      locale="en"
      detailsByKey={{ 'item@1': item, 'set@1': set }}
      decisions={{
        'item@1': { templateId: 'item', revision: 1, resolution: 'Create', localPrice: 10 },
        'set@1': { templateId: 'set', revision: 1, resolution: 'Create', localName: 'Stale source name' },
      }}
      canChooseCandidate={() => true}
      onChooseCandidate={jest.fn()}
    />,
  );

  expect(screen.getByText('Tenant sauces')).toBeInTheDocument();
  expect(screen.queryByText('Stale source name')).not.toBeInTheDocument();
  expect(screen.queryByText('source-sauce')).not.toBeInTheDocument();
});
