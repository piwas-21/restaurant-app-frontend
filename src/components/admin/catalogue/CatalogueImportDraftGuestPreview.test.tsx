import React from 'react';
import { render, screen } from '@testing-library/react';
import type { CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import CatalogueImportDraftGuestPreview from './CatalogueImportDraftGuestPreview';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => (options?.name ? `${key}:${options.name}` : key),
  }),
}));

function revision(
  templateId: string,
  type: CatalogueTemplateRevision['type'],
  payload: CatalogueTemplateRevision['payload'],
): CatalogueTemplateRevision {
  return {
    schemaVersion: 1,
    templateId,
    revision: 1,
    type,
    cuisines: [],
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
  } as CatalogueTemplateRevision;
}

it('shows ordered bundle choices with draft local prices and intended availability', () => {
  const bundle = revision('tacos', 'bundle', {
    sections: [
      {
        sectionKey: 'meat',
        name: 'Meat',
        translations: { fr: { name: 'Viande' } },
        sortOrder: 1,
        min: 1,
        max: 1,
        options: [{ templateId: 'kebab', revision: 1, sortOrder: 1, default: true }],
      },
    ],
    requiredLocalReviewFields: [],
  });
  const kebab = revision('kebab', 'item', {
    suggestedIngredients: [],
    optionSets: [],
    sideSets: [],
    requiredLocalReviewFields: [],
  });
  render(
    <CatalogueImportDraftGuestPreview
      detail={bundle}
      locale="fr"
      detailsByKey={{ 'tacos@1': bundle, 'kebab@1': kebab }}
      decisions={{
        'tacos@1': {
          templateId: 'tacos',
          revision: 1,
          resolution: 'Create',
          localPrice: 12,
          localOptionPrices: { 'kebab@1': 0.5 },
          intendedIsAvailable: false,
        },
      }}
    />,
  );

  expect(screen.getByText('Viande')).toBeInTheDocument();
  expect(screen.getByText('kebab')).toBeInTheDocument();
  expect(screen.getByText('catalogue_default')).toBeInTheDocument();
  expect(screen.getByText(/0[.,]50/)).toBeInTheDocument();
  expect(screen.getByText(/12[.,]00/)).toBeInTheDocument();
  expect(screen.getByText(/unavailable/)).toBeInTheDocument();
});

it('shows a missing local choice price without inventing zero', () => {
  const set = revision('sauces', 'option-set', {
    kind: 'sauce',
    min: 0,
    max: 2,
    options: [{ templateId: 'samourai', revision: 1, sortOrder: 1 }],
  });
  const item = revision('taco', 'item', {
    suggestedIngredients: [],
    optionSets: [{ templateId: 'sauces', revision: 1 }],
    sideSets: [],
    requiredLocalReviewFields: [],
  });
  render(
    <CatalogueImportDraftGuestPreview
      detail={item}
      locale="en"
      detailsByKey={{ 'taco@1': item, 'sauces@1': set }}
      decisions={{
        'taco@1': { templateId: 'taco', revision: 1, resolution: 'Create' },
        'sauces@1': { templateId: 'sauces', revision: 1, resolution: 'Create' },
      }}
    />,
  );

  expect(screen.getByText('sauces')).toBeInTheDocument();
  expect(screen.getByText('samourai')).toBeInTheDocument();
  expect(screen.getAllByText('catalogue_import_draft_price_needed').length).toBeGreaterThan(0);
});

it('shows suggested sides at their item price without demanding option-set prices', () => {
  const set = revision('sides', 'option-set', {
    kind: 'suggested-side',
    min: 0,
    max: 1,
    options: [{ templateId: 'fries', revision: 1, sortOrder: 0 }],
  });
  const item = revision('burger', 'item', {
    suggestedIngredients: [],
    optionSets: [],
    sideSets: [{ templateId: 'sides', revision: 1 }],
    requiredLocalReviewFields: [],
  });
  render(
    <CatalogueImportDraftGuestPreview
      detail={item}
      locale="en"
      detailsByKey={{ 'burger@1': item, 'sides@1': set }}
      decisions={{
        'burger@1': { templateId: 'burger', revision: 1, resolution: 'Create', localPrice: 10 },
        'sides@1': { templateId: 'sides', revision: 1, resolution: 'Create' },
        'fries@1': { templateId: 'fries', revision: 1, resolution: 'Create', localPrice: 3 },
      }}
    />,
  );

  expect(screen.getByText('suggested_side_items_description')).toBeInTheDocument();
  expect(screen.getByText(/3[.,]00/)).toBeInTheDocument();
  expect(screen.queryByText('catalogue_import_draft_price_needed')).not.toBeInTheDocument();
});

it('does not present source choices or creation visibility for a reused offer', () => {
  const bundle = revision('bundle', 'bundle', {
    sections: [{ sectionKey: 'main', name: 'Source section', sortOrder: 0, min: 1, max: 1, options: [] }],
    requiredLocalReviewFields: [],
  });
  render(
    <CatalogueImportDraftGuestPreview
      detail={bundle}
      locale="en"
      detailsByKey={{ 'bundle@1': bundle }}
      reusedNamesByKey={{ 'bundle@1': 'Tenant menu' }}
      decisions={{
        'bundle@1': {
          templateId: 'bundle',
          revision: 1,
          resolution: 'Reuse',
          localEntityId: 'local-bundle',
          localName: 'Stale draft name',
        },
      }}
    />,
  );

  expect(screen.getByText('catalogue_import_reuse_preserves_local')).toBeInTheDocument();
  expect(screen.getByText(/catalogue_import_price_for:Tenant menu/)).toBeInTheDocument();
  expect(screen.queryByText(/Stale draft name/)).not.toBeInTheDocument();
  expect(screen.queryByText('Source section')).not.toBeInTheDocument();
  expect(screen.queryByText('catalogue_import_import_visibility_note')).not.toBeInTheDocument();
});

it('does not present source choice prices for a reused option set', () => {
  const set = revision('sauces', 'option-set', {
    kind: 'sauce',
    min: 0,
    max: 1,
    options: [{ templateId: 'source-sauce', revision: 1, sortOrder: 0 }],
  });
  const item = revision('item', 'item', {
    suggestedIngredients: [],
    optionSets: [{ templateId: 'sauces', revision: 1 }],
    sideSets: [],
    requiredLocalReviewFields: [],
  });
  render(
    <CatalogueImportDraftGuestPreview
      detail={item}
      locale="en"
      detailsByKey={{ 'item@1': item, 'sauces@1': set }}
      reusedNamesByKey={{ 'sauces@1': 'Restaurant sauces' }}
      decisions={{
        'item@1': { templateId: 'item', revision: 1, resolution: 'Create', localPrice: 10 },
        'sauces@1': {
          templateId: 'sauces',
          revision: 1,
          resolution: 'Reuse',
          localEntityId: 'local-sauces',
          localName: 'Stale sauces',
        },
      }}
    />,
  );

  expect(screen.getByText('catalogue_import_reuse_preserves_local')).toBeInTheDocument();
  expect(screen.getByText('Restaurant sauces')).toBeInTheDocument();
  expect(screen.queryByText('Stale sauces')).not.toBeInTheDocument();
  expect(screen.queryByText('catalogue_choose_up_to')).not.toBeInTheDocument();
  expect(screen.queryByText('source-sauce')).not.toBeInTheDocument();
});

it('uses the resolved tenant name for a reused bundle choice with a stale draft name', () => {
  const bundle = revision('bundle', 'bundle', {
    sections: [
      {
        sectionKey: 'main',
        name: 'Main',
        sortOrder: 0,
        min: 1,
        max: 1,
        options: [{ templateId: 'choice', revision: 1, sortOrder: 0 }],
      },
    ],
    requiredLocalReviewFields: [],
  });
  render(
    <CatalogueImportDraftGuestPreview
      detail={bundle}
      locale="en"
      detailsByKey={{ 'bundle@1': bundle }}
      reusedNamesByKey={{ 'choice@1': 'Tenant filling' }}
      decisions={{
        'bundle@1': {
          templateId: 'bundle',
          revision: 1,
          resolution: 'Create',
          localPrice: 10,
          localOptionPrices: { 'choice@1': 0 },
        },
        'choice@1': { templateId: 'choice', revision: 1, resolution: 'Reuse', localName: 'Stale filling' },
      }}
    />,
  );

  expect(screen.getByText('Tenant filling')).toBeInTheDocument();
  expect(screen.queryByText('Stale filling')).not.toBeInTheDocument();
});

it('uses reviewed local names for a newly created offer and choice', () => {
  const bundle = revision('template-bundle', 'bundle', {
    sections: [
      {
        sectionKey: 'main',
        name: 'Main',
        sortOrder: 0,
        min: 1,
        max: 1,
        options: [{ templateId: 'template-choice', revision: 1, sortOrder: 0 }],
      },
    ],
    requiredLocalReviewFields: [],
  });
  render(
    <CatalogueImportDraftGuestPreview
      detail={bundle}
      locale="en"
      detailsByKey={{ 'template-bundle@1': bundle }}
      decisions={{
        'template-bundle@1': {
          templateId: 'template-bundle',
          revision: 1,
          resolution: 'Create',
          localName: 'My menu',
          localPrice: 12,
          localOptionPrices: { 'template-choice@1': 0 },
        },
        'template-choice@1': {
          templateId: 'template-choice',
          revision: 1,
          resolution: 'Create',
          localName: 'My filling',
        },
      }}
    />,
  );

  expect(screen.getByText(/catalogue_import_price_for:My menu/)).toBeInTheDocument();
  expect(screen.getByText('My filling')).toBeInTheDocument();
  expect(screen.queryByText('template-choice')).not.toBeInTheDocument();
});
