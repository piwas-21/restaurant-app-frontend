import React from 'react';
import { render, screen } from '@testing-library/react';
import MenuCatalogueSuggestions from './MenuCatalogueSuggestions';
import { useMenuCatalogueSuggestions } from '@/hooks/admin/useMenuCatalogueSuggestions';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/admin/useMenuCatalogueSuggestions', () => ({ useMenuCatalogueSuggestions: jest.fn() }));

const template = {
  templateId: 'meal',
  revision: 2,
  type: 'bundle' as const,
  cuisines: ['turkish'],
  displayName: 'Meal Combo',
  sourceLocale: 'tr' as const,
  displayLocale: 'en' as const,
  usedSourceFallback: false,
  reviewedTranslationLocales: ['en' as const],
  dependencyCount: 3,
  compatibleTenantContractVersions: [1],
};

describe('MenuCatalogueSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useMenuCatalogueSuggestions).mockReturnValue({
      templates: [template],
      isLoading: false,
      error: null,
      retry: jest.fn(),
      isVisible: true,
    });
  });

  it('shows reviewed item and bundle suggestions below the tenant name query', () => {
    render(<MenuCatalogueSuggestions query="meal" />);

    expect(screen.getByRole('region', { name: 'menu_catalogue_suggestions_title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meal Combo' })).toBeInTheDocument();
    expect(screen.getByText('turkish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'catalogue_preview' })).toBeInTheDocument();
    expect(useMenuCatalogueSuggestions).toHaveBeenCalledWith('meal', 'en');
  });

  it('does not render for short menu queries', () => {
    jest.mocked(useMenuCatalogueSuggestions).mockReturnValue({
      templates: [],
      isLoading: false,
      error: null,
      retry: jest.fn(),
      isVisible: false,
    });
    const { container } = render(<MenuCatalogueSuggestions query="m" />);

    expect(container).toBeEmptyDOMElement();
  });
});
