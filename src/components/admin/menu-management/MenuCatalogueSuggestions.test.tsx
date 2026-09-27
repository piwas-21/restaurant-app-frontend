import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('loads suggestions only after the admin opens the browse panel', () => {
    render(<MenuCatalogueSuggestions query="meal" />);

    const trigger = screen.getByRole('button', { name: 'menu_catalogue_browse_suggestions' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'menu_catalogue_suggestions_title' })).not.toBeInTheDocument();
    expect(useMenuCatalogueSuggestions).toHaveBeenLastCalledWith('', 'en');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'menu_catalogue_suggestions_title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meal Combo' })).toBeInTheDocument();
    expect(screen.getByText('turkish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'catalogue_preview' })).toBeInTheDocument();
    expect(useMenuCatalogueSuggestions).toHaveBeenCalledWith('meal', 'en');
  });

  it('offers the full catalogue for a short query without searching', () => {
    jest.mocked(useMenuCatalogueSuggestions).mockReturnValue({
      templates: [],
      isLoading: false,
      error: null,
      retry: jest.fn(),
      isVisible: false,
    });
    render(<MenuCatalogueSuggestions query="m" />);

    fireEvent.click(screen.getByRole('button', { name: 'menu_catalogue_browse_suggestions' }));

    expect(screen.getByText('menu_catalogue_suggestions_short_query')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'menu_catalogue_browse_all' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'menu_catalogue_suggestions_title' })).not.toBeInTheDocument();
    expect(useMenuCatalogueSuggestions).toHaveBeenLastCalledWith('m', 'en');
  });

  it('closes on Escape and returns focus to the browse control', () => {
    render(<MenuCatalogueSuggestions query="meal" />);
    const trigger = screen.getByRole('button', { name: 'menu_catalogue_browse_suggestions' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('region', { name: 'menu_catalogue_suggestions_title' }), { key: 'Escape' });

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'menu_catalogue_suggestions_title' })).not.toBeInTheDocument();
  });
});
