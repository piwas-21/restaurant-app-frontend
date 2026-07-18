import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CraftCategoryNav from './CraftCategoryNav';
import type { CategoryNavProps } from '@/components/menu/CategoryNav';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import type { ApiCategory } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const cat = (id: string, name: string) => ({ id, name }) as unknown as ApiCategory;

const renderNav = (props: Partial<CategoryNavProps> = {}) =>
  render(
    <CraftCategoryNav
      categories={[cat('c1', 'Grills')]}
      selectedView={ALL_ITEMS_KEY}
      onSelect={() => {}}
      allLabel="All"
      {...props}
    />,
  );

describe('CraftCategoryNav', () => {
  it('renders All, Menu Bundles and each category as tab buttons', () => {
    renderNav();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'menu_bundles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grills' })).toBeInTheDocument();
  });

  it('marks only the selected tab active via aria-pressed', () => {
    renderNav({ selectedView: 'c1' });
    expect(screen.getByRole('button', { name: 'Grills' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect with the tab id when a tab is clicked', () => {
    const onSelect = jest.fn();
    renderNav({ onSelect });
    fireEvent.click(screen.getByRole('button', { name: 'Grills' }));
    expect(onSelect).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByRole('button', { name: 'menu_bundles' }));
    expect(onSelect).toHaveBeenCalledWith(MENU_BUNDLES_KEY);
  });

  it('sets a per-tab tilt custom property so the tapes look hand-placed', () => {
    renderNav();
    // The tilt is data-driven (a --tab-tilt CSS var), not a fixed class.
    expect(screen.getByRole('button', { name: 'All' })).toHaveStyle({ '--tab-tilt': '-2deg' });
  });
});
