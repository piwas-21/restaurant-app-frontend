import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import MenuContent from './MenuContent';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';
import type { MenuListProps } from './MenuList';
import type { MenuFilterOption } from '@/hooks/menu/useMenuFilters';
import type { MenuItem, MenuBundleItem } from '@/types/menu';

/**
 * Issue B: a combo is listed under the tabs of the categories its main dish belongs to, in the
 * SAME grid as the tab's plain dishes, and under the SAME filter chips. What is pinned here is the
 * grouping decision — which bundles reach the grid on each of the three views, and that the merged
 * list feeds the filter tally.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, arg?: unknown) => (typeof arg === 'string' ? arg : key) }),
}));
const listProps: MenuListProps[] = [];
jest.mock('./MenuList', () => (props: MenuListProps) => {
  listProps.push(props);
  return null;
});
const filterProps: Array<{ options: MenuFilterOption[] }> = [];
jest.mock('./MenuFilters', () => (props: { options: MenuFilterOption[] }) => {
  filterProps.push(props);
  return null;
});
jest.mock('@/components/common/Pagination', () => () => null);
// The status surface OWNS the filters slot — render it through, or the filter tally is never
// mounted and the assertion below reads an empty capture instead of the real options.
jest.mock('./MenuSectionStatus', () => (props: { filtersSlot?: unknown }) => props.filtersSlot ?? null);

function dish(id: string): MenuItem {
  return {
    id,
    name: id,
    content: { en: { name: id, description: '', ingredient: '' } },
    price: 4,
    image: '',
    dietaryTags: [],
  };
}

function menuDefinition() {
  return {
    id: 'md-1',
    isAlwaysAvailable: true,
    startTime: undefined,
    endTime: undefined,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [],
  };
}

function combo(id: string, categoryIds: string[], allergens: string[] = []): MenuBundleItem {
  return {
    id,
    name: id,
    basePrice: 12,
    content: {},
    menuDefinition: menuDefinition(),
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    displayOrder: 0,
    allergens,
    categoryIds,
  };
}

const base = {
  categoryDisplayName: 'Viande',
  isLoadingItems: false,
  errorLoadingItems: null,
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  pageSize: 200,
  onPageChange: jest.fn(),
  onOpenItem: jest.fn(),
};

const viande = combo('LIBANAISE 1 VIANDE', ['cat-libanaise', 'cat-viande']);
const dessert = combo('DESSERT COMBO', ['cat-dessert']);

beforeEach(() => {
  listProps.length = 0;
  filterProps.length = 0;
});

describe("MenuContent — bundles are grouped into their categories' tabs", () => {
  it('shows a category tab its dishes PLUS the bundles listed in it', () => {
    render(
      <MenuContent
        {...base}
        selectedView="cat-viande"
        currentMenuItems={[dish('kefta')]}
        menuBundles={[viande, dessert]}
      />,
    );

    const props = listProps.at(-1)!;
    expect(props.products.map((p) => p.id)).toEqual(['kefta']);
    expect(props.bundles.map((b) => b.id)).toEqual(['LIBANAISE 1 VIANDE']);
  });

  it('leaves a tab that names none of the bundles empty rather than leaking one in', () => {
    render(<MenuContent {...base} selectedView="cat-poisson" currentMenuItems={[]} menuBundles={[viande, dessert]} />);

    // No dishes of its own, no bundles naming the tab: the grid stays down and the empty state
    // shows. MenuList not mounting at all IS the correct observable here.
    expect(listProps.at(-1)).toBeUndefined();
  });

  it('keeps the full menu products-only — the bundles area is the combined listing', () => {
    render(
      <MenuContent {...base} selectedView={ALL_ITEMS_KEY} currentMenuItems={[dish('kefta')]} menuBundles={[viande]} />,
    );

    const props = listProps.at(-1)!;
    expect(props.products.map((p) => p.id)).toEqual(['kefta']);
    expect(props.bundles).toEqual([]);
  });

  it('keeps the bundles view showing every bundle', () => {
    render(
      <MenuContent {...base} selectedView={MENU_BUNDLES_KEY} currentMenuItems={[]} menuBundles={[viande, dessert]} />,
    );

    const props = listProps.at(-1)!;
    expect(props.products).toEqual([]);
    expect(props.bundles.map((b) => b.id)).toEqual(['LIBANAISE 1 VIANDE', 'DESSERT COMBO']);
  });

  it('renders a category that has only bundles instead of calling it empty', () => {
    render(<MenuContent {...base} selectedView="cat-libanaise" currentMenuItems={[]} menuBundles={[viande]} />);

    // The grid must be non-empty — asserted indirectly via MenuList receiving the combo — which is
    // what keeps the "no dishes here yet" panel from printing above a visible combo.
    expect(listProps.at(-1)!.bundles.map((b) => b.id)).toEqual(['LIBANAISE 1 VIANDE']);
  });

  it("counts the tab's bundles in the filter tally, not just its dishes", () => {
    render(
      <MenuContent
        {...base}
        selectedView="cat-viande"
        currentMenuItems={[dish('kefta')]}
        menuBundles={[combo('COMBO GLUTEN', ['cat-viande'], ['gluten'])]}
      />,
    );

    const ids = filterProps.at(-1)!.options.map((option) => option.id);
    expect(ids).toContain('without:gluten');
  });
});
