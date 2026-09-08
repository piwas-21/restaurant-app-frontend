import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
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
const filterProps: Array<{ options: MenuFilterOption[]; onToggle: (id: string) => void }> = [];
jest.mock('./MenuFilters', () => (props: { options: MenuFilterOption[]; onToggle: (id: string) => void }) => {
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

describe('MenuContent — the tenant "bundles on All" setting (mcdoner partner request)', () => {
  it("default (off): the All view stays products-only — today's behaviour, unchanged", () => {
    // The prop is ABSENT, exactly as every pre-setting caller renders: the group must not
    // appear and the one grid must carry the products alone.
    render(
      <MenuContent {...base} selectedView={ALL_ITEMS_KEY} currentMenuItems={[dish('kefta')]} menuBundles={[viande]} />,
    );

    expect(listProps).toHaveLength(1);
    expect(listProps[0].products.map((p) => p.id)).toEqual(['kefta']);
    expect(listProps[0].bundles).toEqual([]);
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('on: the All view keeps its product grid AND gains the bundles as a headed group below it', () => {
    render(
      <MenuContent
        {...base}
        selectedView={ALL_ITEMS_KEY}
        currentMenuItems={[dish('kefta')]}
        menuBundles={[viande, dessert]}
        showBundlesOnAllView
      />,
    );

    const [mainList, groupList] = listProps.slice(-2);
    // The product grid is not diluted: same products, and the bundles do NOT leak into it.
    expect(mainList.products.map((p) => p.id)).toEqual(['kefta']);
    expect(mainList.bundles).toEqual([]);
    // The group below is bundles-only, with its own heading of the third rank (the All
    // view's h2 above already names where the guest is).
    expect(groupList.products).toEqual([]);
    expect(groupList.bundles.map((b) => b.id)).toEqual(['LIBANAISE 1 VIANDE', 'DESSERT COMBO']);
    expect(screen.getByRole('heading', { level: 3, name: 'menu_bundles' })).toBeInTheDocument();
  });

  it("on: the bundles are the combined listing — every bundle, not one category's slice", () => {
    // On the All view there is no category slice to compute; the setting reuses exactly
    // what the bundles tab shows.
    render(
      <MenuContent
        {...base}
        selectedView={ALL_ITEMS_KEY}
        currentMenuItems={[dish('kefta')]}
        menuBundles={[viande, dessert]}
        showBundlesOnAllView
      />,
    );

    const groupList = listProps.at(-1)!;
    expect(groupList.bundles.map((b) => b.id)).toEqual(['LIBANAISE 1 VIANDE', 'DESSERT COMBO']);
  });

  it('on: the group shows on page 1 only — page 2 of products is a different scroll decision', () => {
    render(
      <MenuContent
        {...base}
        selectedView={ALL_ITEMS_KEY}
        currentPage={2}
        currentMenuItems={[dish('kefta-p2')]}
        menuBundles={[viande]}
        showBundlesOnAllView
      />,
    );

    expect(listProps).toHaveLength(1);
    expect(listProps[0].products.map((p) => p.id)).toEqual(['kefta-p2']);
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('on: counts the All-view bundles in the filter tally too', () => {
    render(
      <MenuContent
        {...base}
        selectedView={ALL_ITEMS_KEY}
        currentMenuItems={[dish('kefta')]}
        menuBundles={[combo('COMBO GLUTEN', ['cat-viande'], ['gluten'])]}
        showBundlesOnAllView
      />,
    );

    const ids = filterProps.at(-1)!.options.map((option) => option.id);
    expect(ids).toContain('without:gluten');
  });

  it('on: a chip that filters the bundles out hides the empty group but keeps the products', async () => {
    render(
      <MenuContent
        {...base}
        selectedView={ALL_ITEMS_KEY}
        currentMenuItems={[dish('kefta')]}
        menuBundles={[combo('COMBO GLUTEN', ['cat-viande'], ['gluten'])]}
        showBundlesOnAllView
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'menu_bundles' })).toBeInTheDocument();

    // Press "No gluten" through the filter row's own toggle — the combo carries gluten and
    // drops out of both the tally and the grid.
    await act(async () => {
      filterProps.at(-1)!.onToggle('without:gluten');
    });

    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    const mainList = listProps.at(-1)!;
    expect(mainList.products.map((p) => p.id)).toEqual(['kefta']);
  });
});
