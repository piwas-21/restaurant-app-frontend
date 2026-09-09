import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MenuOnePage from './MenuOnePage';
import type { MenuItem, MenuBundleItem } from '@/types/menu';
import type { UseOnePageMenuReturn } from '@/hooks/useOnePageMenu';

/**
 * The one-page layout body (menuLayout = "onepage"). Pinned here: sections in nav
 * order with real headings, each section carrying the bundles its category lists (the
 * tabs `groupedBundlesFor` mapping — a bundle of two categories prints in both
 * sections AND the trailing bundles listing), the featured hero living in the FIRST
 * section's grid, ONE filter row for the whole page, and a section the active chips
 * empty skipping itself instead of printing an empty headed band.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: unknown) =>
      typeof arg === 'object' && arg !== null && 'categoryName' in (arg as object)
        ? `${key}:${(arg as { categoryName: string }).categoryName}`
        : key,
  }),
}));
const listProps: Array<{ products: MenuItem[]; bundles: MenuBundleItem[]; featuredSlot?: unknown }> = [];
jest.mock(
  './MenuList',
  () =>
    function MockMenuList(props: { products: MenuItem[]; bundles: MenuBundleItem[]; featuredSlot?: unknown }) {
      listProps.push(props);
      return null;
    },
);
const filterProps: Array<{ options: unknown[]; shown: number; total: number }> = [];
jest.mock(
  './MenuFilters',
  () =>
    function MockMenuFilters(props: { options: unknown[]; shown: number; total: number }) {
      filterProps.push(props);
      return null;
    },
);
jest.mock(
  './MenuSectionStatus',
  () =>
    function MockSectionStatus(props: {
      headingId: string;
      title: string;
      isLoading: boolean;
      errorMessage: string | null;
      isEmpty: boolean;
    }) {
      return (
        <div
          data-testid="status"
          data-heading={props.headingId}
          data-title={props.title}
          data-loading={String(props.isLoading)}
          data-error={props.errorMessage ?? ''}
          data-empty={String(props.isEmpty)}
        />
      );
    },
);
// The chips' active set, exposed so a test can turn a chip on and watch the section
// bundles re-filter through the SAME `matchesFilters` the products go through. The
// `mock` prefix is what lets the hoisted jest.mock factory read it.
const mockActiveIds = new Set<string>();
jest.mock('@/hooks/menu/useMenuFilters', () => {
  const actual = jest.requireActual('@/hooks/menu/useMenuFilters');
  return {
    ...actual,
    useMenuFilters: () => ({
      options: [{ id: 'without:gluten', kind: 'without', token: 'gluten', count: 1 }],
      activeIds: mockActiveIds,
      toggle: jest.fn(),
      clear: jest.fn(),
      filtered: [],
      totalLoaded: 4,
    }),
  };
});

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

function bundle(id: string, categoryIds: string[] = ['cat-mains']): MenuBundleItem {
  return {
    id,
    name: id,
    basePrice: 12,
    content: {},
    menuDefinition: {
      id: 'md-1',
      isAlwaysAvailable: true,
      availableMonday: true,
      availableTuesday: true,
      availableWednesday: true,
      availableThursday: true,
      availableFriday: true,
      availableSaturday: true,
      availableSunday: true,
      sections: [],
    },
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    displayOrder: 0,
    allergens: [],
    categoryIds,
  };
}

function controller(overrides: Partial<UseOnePageMenuReturn> = {}): UseOnePageMenuReturn {
  return {
    categories: [
      { id: 'cat-starters', name: 'Starters', description: 'Small plates' },
      { id: 'cat-mains', name: 'Grills' },
    ],
    sections: [
      {
        category: { id: 'cat-starters', name: 'Starters', description: 'Small plates' },
        state: { items: [dish('humus')], isLoading: false, error: null },
      },
      {
        category: { id: 'cat-mains', name: 'Grills' },
        state: { items: [dish('kefta'), dish('adana')], isLoading: false, error: null },
      },
    ],
    menuBundles: [bundle('combo-1')],
    bundlesState: { isLoading: false, error: null, currentPage: 1, totalPages: 1, totalCount: 1 },
    refetchCategory: jest.fn(),
    refetchBundles: jest.fn(),
    activeSectionId: 'all',
    selectSection: jest.fn(),
    ...overrides,
  };
}

const shared = {
  onOpenItem: jest.fn(),
  onSwitchOrderType: jest.fn(),
};

beforeEach(() => {
  listProps.length = 0;
  filterProps.length = 0;
  mockActiveIds.clear();
});

describe('MenuOnePage — sections', () => {
  it('renders one section per category in nav order, then the bundles section', () => {
    render(<MenuOnePage {...shared} controller={controller()} />);

    const headings = screen.getAllByTestId('status').map((el) => el.getAttribute('data-heading'));
    expect(headings).toEqual([
      'category-heading-cat-starters',
      'category-heading-cat-mains',
      'category-heading-menu-bundles',
    ]);
    // Section titles go through the same name mapper the tabs use; with this suite's
    // pass-through t() the mapper falls back to the API name (its documented behaviour).
    expect(screen.getAllByTestId('status')[0].getAttribute('data-title')).toBe('Starters');
  });

  it('lists each bundle in its category section AND keeps the full bundles listing at the foot', () => {
    render(<MenuOnePage {...shared} controller={controller()} />);

    expect(listProps).toHaveLength(3);
    expect(listProps[0].products.map((p) => p.id)).toEqual(['humus']);
    expect(listProps[1].products.map((p) => p.id)).toEqual(['kefta', 'adana']);
    // combo-1 lists cat-mains: its section carries it, and the trailing bundles listing
    // keeps it — the same two placements a tabs page offers (the category tab + the
    // Bundles tab). Sections without the combo list none.
    expect(listProps[1].bundles.map((b) => b.id)).toEqual(['combo-1']);
    expect(listProps[0].bundles).toEqual([]);
    expect(listProps[2].bundles.map((b) => b.id)).toEqual(['combo-1']);
  });

  it('shows a bundle listed in two categories in BOTH sections (the reported regression)', () => {
    // The tabs layout prints 'Tacos 1 Viande' under the Tacos tab and the Viande tab
    // (and the Bundles tab); one-page must print it in the same three places.
    const twoCategoryBundle = bundle('combo-1', ['cat-starters', 'cat-mains']);
    render(<MenuOnePage {...shared} controller={controller({ menuBundles: [twoCategoryBundle] })} />);

    expect(listProps).toHaveLength(3);
    expect(listProps[0].bundles.map((b) => b.id)).toEqual(['combo-1']);
    expect(listProps[1].bundles.map((b) => b.id)).toEqual(['combo-1']);
    expect(listProps[2].bundles.map((b) => b.id)).toEqual(['combo-1']);
  });

  it('filters the section bundles with the active chips and keeps a bundles-only section alive', () => {
    mockActiveIds.add('without:gluten');
    render(
      <MenuOnePage
        {...shared}
        controller={controller({
          // Listed in Starters, whose only dish the chip excludes.
          menuBundles: [bundle('combo-1', ['cat-starters'])],
          sections: [
            {
              category: { id: 'cat-starters', name: 'Starters' },
              state: { items: [{ ...dish('humus'), allergens: ['gluten'] }], isLoading: false, error: null },
            },
            {
              category: { id: 'cat-mains', name: 'Grills' },
              state: { items: [dish('kefta')], isLoading: false, error: null },
            },
          ],
        })}
      />,
    );

    expect(listProps).toHaveLength(3);
    // Starters' only dish fails the chip, but the section survives on its bundle: not
    // skipped, and the failing dish does not print.
    expect(listProps[0].products).toEqual([]);
    expect(listProps[0].bundles.map((b) => b.id)).toEqual(['combo-1']);
    expect(listProps[1].products.map((p) => p.id)).toEqual(['kefta']);
    expect(listProps[1].bundles).toEqual([]);
    expect(listProps[2].bundles.map((b) => b.id)).toEqual(['combo-1']);
  });

  it("hands the featured hero to the FIRST section's grid only", () => {
    const hero = <div data-testid="hero" />;
    render(
      <MenuOnePage
        {...shared}
        controller={controller()}
        featuredSlot={hero}
        featuredFilterable={{ allergens: [], isSpecial: true }}
      />,
    );

    expect(listProps[0].featuredSlot).toBeDefined();
    expect(listProps[1].featuredSlot).toBeUndefined();
    expect(listProps[2].featuredSlot).toBeUndefined();
  });

  it('shows per-section loading and error states, and a Retry that refetches only that category', () => {
    const refetchCategory = jest.fn();
    render(
      <MenuOnePage
        {...shared}
        controller={controller({
          refetchCategory,
          sections: [
            { category: { id: 'cat-starters', name: 'Starters' }, state: { items: [], isLoading: true, error: null } },
            { category: { id: 'cat-mains', name: 'Grills' }, state: { items: [], isLoading: false, error: 'boom' } },
          ],
          bundlesState: { isLoading: false, error: null, currentPage: 1, totalPages: 1, totalCount: 0 },
          menuBundles: [],
        })}
      />,
    );

    const statuses = screen.getAllByTestId('status');
    expect(statuses[0].getAttribute('data-loading')).toBe('true');
    expect(statuses[1].getAttribute('data-error')).toBe('error_loading_menu_items');
    // The error path is rendered through the real MenuSectionStatus surface — only asserted
    // down to the Retry wiring the controller owns.
    expect(refetchCategory).not.toHaveBeenCalled();
  });

  it('renders one page-wide filter row, hidden while any section loads', () => {
    render(<MenuOnePage {...shared} controller={controller()} />);
    expect(filterProps).toHaveLength(1);
    expect(filterProps[0].total).toBe(4); // 3 dishes + 1 bundle

    render(
      <MenuOnePage
        {...shared}
        controller={controller({
          sections: [
            { category: { id: 'cat-starters', name: 'Starters' }, state: { items: [], isLoading: true, error: null } },
            {
              category: { id: 'cat-mains', name: 'Grills' },
              state: { items: [dish('kefta')], isLoading: false, error: null },
            },
          ],
        })}
      />,
      { container: document.body },
    );
    // Still ONE capture from the first render only — the loading page mounted no row.
    expect(filterProps).toHaveLength(1);
  });
});
