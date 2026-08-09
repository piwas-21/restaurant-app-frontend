import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CraftCategoryNav from './CraftCategoryNav';
import type { CategoryNavProps } from '@/components/menu/CategoryNav';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import type { ApiCategory } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown, vars?: Record<string, string>) => {
      const template = typeof fallback === 'string' ? fallback : key;
      if (!vars) return template;
      return Object.entries(vars).reduce((out, [name, value]) => out.replaceAll(`{{${name}}}`, value), template);
    },
  }),
}));

jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn(() => ({ state: { orderType: null } })) }));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({
  useEnabledOrderTypes: jest.fn(() => ({ enabled: [], loading: false })),
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

// The §4.4 case below overrides these; reset so the mock cannot leak into a later suite.
beforeEach(() => {
  (useEnabledOrderTypes as jest.Mock).mockReturnValue({ enabled: [], loading: false });
});

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

describe('CraftCategoryNav — channel restriction chip (§4.4)', () => {
  it('folds the restriction into the tab’s accessible name — the craft half of §4.5', () => {
    (useEnabledOrderTypes as jest.Mock).mockReturnValue({
      enabled: [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery],
      loading: false,
    });
    renderNav({
      categories: [
        { id: 'c1', name: 'Wraps', allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery] } as ApiCategory,
      ],
    });

    expect(screen.getByRole('button', { name: 'Wraps Takeaway and Delivery only' })).toBeInTheDocument();
  });
  it('forwards the `trailing` slot — /menu has no basket without it', () => {
    // /menu is ONE page for both templates; only the surfaces differ. When the basket rail left
    // that page it left this template's too, and the slot in the sticky bar is what replaced it.
    // A nav that accepts the prop and drops it leaves a guest with no basket and no order-type
    // picker at all — the floating cart button renders nothing while the basket is empty. That is
    // exactly what shipped for craft in the first cut of this change, and it was caught by a
    // screenshot run rather than by a test.
    render(
      <CraftCategoryNav
        categories={[]}
        selectedView="all"
        onSelect={jest.fn()}
        allLabel="All"
        trailing={<button type="button">Open basket</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open basket' })).toBeInTheDocument();
  });
});
