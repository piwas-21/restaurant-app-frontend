import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CatalogueTemplateBrowser from './CatalogueTemplateBrowser';
import { getCatalogueTemplateRevision, listCatalogueTemplates } from '@/services/catalogueTemplateService';
import type {
  CatalogueTemplateDependency,
  CatalogueTemplateListResponse,
  CatalogueTemplateRevision,
  CatalogueTemplateSummary,
} from '@/services/catalogueTemplateService';

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
    i18n: { language: 'fr-CH', resolvedLanguage: 'fr-CH' },
  }),
}));

jest.mock('@/services/catalogueTemplateService', () => ({
  ...jest.requireActual('@/services/catalogueTemplateService'),
  getCatalogueTemplateRevision: jest.fn(),
  listCatalogueTemplates: jest.fn(),
}));

jest.mock('@/services/catalogueImportService', () => ({
  ...jest.requireActual('@/services/catalogueImportService'),
  getCataloguePreferences: jest.fn().mockResolvedValue({ cuisines: [] }),
  putCataloguePreferences: jest.fn(),
}));

const template: CatalogueTemplateSummary = {
  templateId: 'turkish-soup-bundle',
  revision: 3,
  type: 'bundle',
  cuisines: ['turkish'],
  displayName: 'Soup and bread menu',
  sourceLocale: 'tr',
  displayLocale: 'fr',
  usedSourceFallback: false,
  reviewedTranslationLocales: ['en', 'fr'],
  dependencyCount: 1,
  compatibleTenantContractVersions: [1],
};

const listResponse: CatalogueTemplateListResponse = { items: [template], nextCursor: 'cursor-2' };

const bundleDetail: CatalogueTemplateRevision = {
  schemaVersion: 1,
  templateId: template.templateId,
  revision: template.revision,
  type: 'bundle',
  cuisines: template.cuisines,
  name: 'Çorba ve ekmek menüsü',
  description: 'A warm meal with a choice of soup.',
  sourceLocale: 'tr',
  translations: { fr: { name: 'Menu soupe et pain', description: 'Un repas chaud avec une soupe au choix.' } },
  localeFallbacks: ['tr'],
  dependencies: [{ templateId: 'lentil-soup', revision: 2, role: 'bundle-option' }],
  provenance: {
    contentOrigin: 'sofra-original',
    sourceDescription: 'Created by Sofra menu editors.',
    license: 'Sofra catalogue terms',
    mediaAssets: [],
  },
  qualityStatus: 'reviewed',
  compatibleTenantContractVersions: [1],
  contentHash: 'hash-3',
  payload: {
    sections: [
      {
        sectionKey: 'soup-choice',
        name: 'Soup choice',
        sortOrder: 1,
        min: 1,
        max: 1,
        options: [{ templateId: 'lentil-soup', revision: 2, sortOrder: 1, default: true }],
      },
    ],
    requiredLocalReviewFields: ['price', 'allergens', 'availability'],
  },
};

const soupDetail: CatalogueTemplateRevision = {
  ...bundleDetail,
  templateId: 'lentil-soup',
  revision: 2,
  type: 'item',
  name: 'Lentil soup',
  description: null,
  translations: {},
  dependencies: [],
  payload: { suggestedIngredients: [], optionSets: [], sideSets: [], requiredLocalReviewFields: [] },
};

describe('CatalogueTemplateBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
    (listCatalogueTemplates as jest.Mock).mockResolvedValue(listResponse);
    (getCatalogueTemplateRevision as jest.Mock).mockImplementation(async (id: string) =>
      id === template.templateId ? bundleDetail : soupDetail,
    );
  });

  it('uses the selected admin language, opens a pinned guest-choice preview, and applies cuisine filters', async () => {
    render(<CatalogueTemplateBrowser />);

    expect(await screen.findByText('Soup and bread menu')).toBeInTheDocument();
    expect((listCatalogueTemplates as jest.Mock).mock.calls[0][0].locale).toBe('fr');

    fireEvent.click(screen.getByRole('button', { name: 'catalogue_preview' }));
    expect(await screen.findByRole('dialog', { name: 'Menu soupe et pain' })).toBeInTheDocument();
    expect(await screen.findByText('Lentil soup')).toBeInTheDocument();
    expect(screen.getByText('catalogue_choose_exactly:1')).toBeInTheDocument();
    expect(screen.getByText('catalogue_review_field_allergens')).toBeInTheDocument();
    expect(screen.queryByText(/CHF|\$|€|price:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'catalogue_start_import' }));
    expect(mockRouterPush).toHaveBeenCalledWith(
      '/admin/menu-management/catalogue/import?templateId=turkish-soup-bundle&revision=3&locale=fr&createNewCopy=false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'catalogue_start_new_copy' }));
    expect(mockRouterPush).toHaveBeenLastCalledWith(
      '/admin/menu-management/catalogue/import?templateId=turkish-soup-bundle&revision=3&locale=fr&createNewCopy=true',
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'turkish' }));
    await waitFor(() => expect(listCatalogueTemplates).toHaveBeenCalledTimes(2));
    expect((listCatalogueTemplates as jest.Mock).mock.calls[1][0]).toMatchObject({ cuisine: 'turkish', locale: 'fr' });
  });

  it('shows an honest empty state when the public catalogue has no reviewed suggestions', async () => {
    (listCatalogueTemplates as jest.Mock).mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<CatalogueTemplateBrowser />);

    expect(await screen.findByRole('heading', { name: 'catalogue_empty' })).toBeInTheDocument();
    expect(screen.getByText('catalogue_empty_guidance')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'catalogue_manual_creation_link' })).toHaveAttribute(
      'href',
      '/admin/menu-management',
    );
    expect(screen.queryByRole('button', { name: 'import' })).not.toBeInTheDocument();
  });

  it('keeps the exact pinned reference visible when an optional dependency lookup fails', async () => {
    (getCatalogueTemplateRevision as jest.Mock).mockImplementation(async (id: string) => {
      if (id === template.templateId) return bundleDetail;
      throw new Error('dependency offline');
    });
    render(<CatalogueTemplateBrowser />);

    await screen.findByText('Soup and bread menu');
    fireEvent.click(screen.getByRole('button', { name: 'catalogue_preview' }));

    expect(await screen.findByText('lentil-soup')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('catalogue_dependency_names_error:1');
  });

  it('reports dependency names omitted by the bounded preview', async () => {
    const dependencies: CatalogueTemplateDependency[] = Array.from({ length: 30 }, (_, index) => ({
      templateId: `extra-template-${index}`,
      revision: 1,
      role: 'ingredient',
    }));
    (getCatalogueTemplateRevision as jest.Mock).mockImplementation(async (id: string) => {
      if (id === template.templateId) return { ...bundleDetail, dependencies };
      return { ...soupDetail, templateId: id, name: id };
    });
    render(<CatalogueTemplateBrowser />);

    await screen.findByText('Soup and bread menu');
    fireEvent.click(screen.getByRole('button', { name: 'catalogue_preview' }));

    expect(await screen.findByText('catalogue_dependency_preview_limit:6')).toBeInTheDocument();
  });

  it('walks opaque cursors forward and back without manufacturing page offsets', async () => {
    const nextPage: CatalogueTemplateListResponse = {
      items: [{ ...template, templateId: 'grilled-plate', displayName: 'Grilled plate' }],
      nextCursor: null,
    };
    (listCatalogueTemplates as jest.Mock)
      .mockResolvedValueOnce(listResponse)
      .mockResolvedValueOnce(nextPage)
      .mockResolvedValueOnce(listResponse);
    render(<CatalogueTemplateBrowser />);

    await screen.findByText('Soup and bread menu');
    fireEvent.click(screen.getByRole('button', { name: 'catalogue_next_page' }));
    expect(await screen.findByText('Grilled plate')).toBeInTheDocument();
    expect((listCatalogueTemplates as jest.Mock).mock.calls[1][0].cursor).toBe('cursor-2');

    fireEvent.click(screen.getByRole('button', { name: 'catalogue_previous_page' }));
    expect(await screen.findByText('Soup and bread menu')).toBeInTheDocument();
    expect((listCatalogueTemplates as jest.Mock).mock.calls[2][0].cursor).toBeNull();
  });

  it('reports read failures and supports an explicit retry', async () => {
    (listCatalogueTemplates as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<CatalogueTemplateBrowser />);

    expect(await screen.findByRole('alert')).toHaveTextContent('catalogue_load_error');
    fireEvent.click(screen.getByRole('button', { name: 'catalogue_retry' }));
    await waitFor(() => expect(listCatalogueTemplates).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'catalogue_empty' })).toBeInTheDocument();
  });
});
