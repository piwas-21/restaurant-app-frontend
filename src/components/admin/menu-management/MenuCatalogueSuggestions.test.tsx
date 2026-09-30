import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuCatalogueSuggestions from './MenuCatalogueSuggestions';
import { useMenuCatalogueSuggestions } from '@/hooks/admin/useMenuCatalogueSuggestions';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => null,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
}));
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

  it('shows published suggestions once the name search reaches two characters', () => {
    const { rerender } = render(<MenuCatalogueSuggestions query="m" />);
    expect(screen.queryByRole('region', { name: 'menu_catalogue_suggestions_title' })).not.toBeInTheDocument();
    expect(useMenuCatalogueSuggestions).toHaveBeenLastCalledWith('', 'en');

    rerender(<MenuCatalogueSuggestions query="me" />);
    expect(screen.getByRole('region', { name: 'menu_catalogue_suggestions_title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meal Combo' })).toBeInTheDocument();
    expect(screen.getByText('turkish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'catalogue_preview' })).toBeInTheDocument();
    expect(useMenuCatalogueSuggestions).toHaveBeenLastCalledWith('me', 'en');
  });

  it('does not show a second catalogue action for a short query', () => {
    render(<MenuCatalogueSuggestions query="m" />);
    expect(screen.queryByRole('region', { name: 'menu_catalogue_suggestions_title' })).not.toBeInTheDocument();
    expect(useMenuCatalogueSuggestions).toHaveBeenLastCalledWith('', 'en');
  });

  it('can dismiss suggestions until the query changes', () => {
    const { rerender } = render(<MenuCatalogueSuggestions query="meal" />);
    fireEvent.click(screen.getByRole('button', { name: 'menu_catalogue_suggestions_close' }));
    expect(screen.queryByRole('region', { name: 'menu_catalogue_suggestions_title' })).not.toBeInTheDocument();
    rerender(<MenuCatalogueSuggestions query="meals" />);
    expect(screen.getByRole('region', { name: 'menu_catalogue_suggestions_title' })).toBeInTheDocument();
  });
});
