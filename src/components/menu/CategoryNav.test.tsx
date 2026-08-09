import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import CategoryNav from './CategoryNav';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import type { ApiCategory } from '@/types/menu';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
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

jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({ useEnabledOrderTypes: jest.fn() }));

const mockOrderType = useOrderType as jest.Mock;
const mockEnabled = useEnabledOrderTypes as jest.Mock;

const ALL = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];

const cat = (id: string, name: string, allowedOrderTypes?: OrderType[]) =>
  ({ id, name, allowedOrderTypes }) as unknown as ApiCategory;

const renderNav = (categories: ApiCategory[] = [cat('c1', 'Grills')]) =>
  render(<CategoryNav categories={categories} selectedView={ALL_ITEMS_KEY} onSelect={() => {}} allLabel="All" />);

beforeEach(() => {
  mockOrderType.mockReturnValue({ state: { orderType: null } });
  mockEnabled.mockReturnValue({ enabled: ALL, loading: false });
});

describe('CategoryNav', () => {
  it('renders All, Menu Bundles and each category as tab buttons', () => {
    renderNav();

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'menu_bundles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grills' })).toBeInTheDocument();
  });

  it('marks only the selected tab active via aria-pressed', () => {
    render(<CategoryNav categories={[cat('c1', 'Grills')]} selectedView="c1" onSelect={() => {}} allLabel="All" />);

    expect(screen.getByRole('button', { name: 'Grills' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect with the tab id when a tab is clicked', () => {
    const onSelect = jest.fn();
    render(
      <CategoryNav
        categories={[cat('c1', 'Grills')]}
        selectedView={ALL_ITEMS_KEY}
        onSelect={onSelect}
        allLabel="All"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Grills' }));
    expect(onSelect).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByRole('button', { name: 'menu_bundles' }));
    expect(onSelect).toHaveBeenCalledWith(MENU_BUNDLES_KEY);
  });
});

describe('CategoryNav — channel restriction chip (§4.4)', () => {
  const wraps = [cat('c1', 'Wraps', [OrderType.Takeaway, OrderType.Delivery])];

  it('folds the restriction into the tab’s accessible name, so the dim is announced with its cause', () => {
    renderNav(wraps);

    expect(screen.getByRole('button', { name: 'Wraps Takeaway and Delivery only' })).toBeInTheDocument();
  });

  it('keeps a blocked category SELECTABLE — a tab that went dead is the "All items looks broken" bug', () => {
    mockOrderType.mockReturnValue({ state: { orderType: OrderType.DineIn } });
    const onSelect = jest.fn();
    render(<CategoryNav categories={wraps} selectedView={ALL_ITEMS_KEY} onSelect={onSelect} allLabel="All" />);

    const tab = screen.getByRole('button', { name: 'Wraps Takeaway and Delivery only' });
    expect(tab).not.toBeDisabled();
    fireEvent.click(tab);
    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('chips nothing on an unrestricted category', () => {
    renderNav([cat('c1', 'Grills', ALL)]);

    expect(screen.getByRole('button', { name: 'Grills' })).toBeInTheDocument();
  });
});

/**
 * The arrows were gated on `tabs.length > 5` — a count — while `useCategoryNavScroll` was already
 * computing the real thing. Nothing here ever queried them, so the false negative shipped: measured
 * on staging at 375px the bar had `scrollWidth 387` against `clientWidth 304`, the third tab was cut
 * mid-word, and no arrow appeared. A seeded screenshot cannot catch it either — the committed mobile
 * baseline has exactly 4 tabs, which is the count the heuristic reads as "no arrows needed".
 *
 * jsdom lays nothing out, so both metrics are permanently 0 and the hook can only ever answer "no".
 * Stubbing them on the prototype is the smallest way to hand it the two numbers the browser would
 * have, and it exercises the real hook + shell wiring rather than a re-implementation of the sum.
 */
describe('CategoryNav — scroll arrows follow overflow, not tab count (S8)', () => {
  const BACK = 'Scroll categories back';
  const FORWARD = 'Scroll categories forward';

  /** Returns the undo, so a failing expectation cannot leak fake metrics into the next suite. */
  const stubScrollMetrics = (metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number }) => {
    const keys = Object.keys(metrics) as (keyof typeof metrics)[];
    keys.forEach((key) =>
      Object.defineProperty(HTMLElement.prototype, key, {
        configurable: true,
        get: () => metrics[key],
        // jsdom's own `scrollLeft` is writable and React may assign to it; a getter-only
        // shadow would throw from module strict mode instead of being ignored.
        set: () => {},
      }),
    );
    return () => keys.forEach((key) => Reflect.deleteProperty(HTMLElement.prototype, key));
  };

  /**
   * The hook re-checks on a 100ms timer after mount, so every assertion below has to be taken after
   * it. Waiting on the clock rather than on `waitFor` matters for the negative case: `waitFor` with
   * a "not in the document" body passes on its first tick, which on an unfired timer would be true
   * of any implementation at all.
   */
  const flushScrollCheck = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 150))));

  // `All` + `menu_bundles` are always prepended, so ONE category is three tabs — under the old
  // `> 5`, and the case the staging measurement caught.
  const oneCategory = [cat('c1', 'Grills')];
  const nineCategories = Array.from({ length: 9 }, (_, i) => cat(`c${i}`, `Category ${i}`));

  it('shows the forward arrow on a row that overflows, even with only three tabs', async () => {
    const restore = stubScrollMetrics({ scrollWidth: 387, clientWidth: 304, scrollLeft: 0 });
    try {
      renderNav(oneCategory);
      await flushScrollCheck();

      expect(screen.getByRole('button', { name: FORWARD })).toBeInTheDocument();
      // Nothing behind the current position yet, so the back arrow stays away.
      expect(screen.queryByRole('button', { name: BACK })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('shows the back arrow once the row has been scrolled off its start', async () => {
    const restore = stubScrollMetrics({ scrollWidth: 387, clientWidth: 304, scrollLeft: 83 });
    try {
      renderNav(oneCategory);
      await flushScrollCheck();

      expect(screen.getByRole('button', { name: BACK })).toBeInTheDocument();
      // 83 of 83 scrollable px travelled — the end, so forward has nothing left to offer.
      expect(screen.queryByRole('button', { name: FORWARD })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('shows neither arrow on a row that fits, however many tabs are in it', async () => {
    const restore = stubScrollMetrics({ scrollWidth: 640, clientWidth: 640, scrollLeft: 0 });
    try {
      renderNav(nineCategories);
      await flushScrollCheck();

      // Eleven tabs — comfortably past the old threshold — and still no arrow, because an arrow
      // that cannot move anything is the other half of the same bug.
      expect(screen.getAllByRole('button')).toHaveLength(11);
      expect(screen.queryByRole('button', { name: FORWARD })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: BACK })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });
  it('forwards the `trailing` slot — /menu has no basket without it', () => {
    // /menu is ONE page for both templates; only the surfaces differ. When the basket rail left
    // that page it left this template's too, and the slot in the sticky bar is what replaced it.
    // A nav that accepts the prop and drops it leaves a guest with no basket and no order-type
    // picker at all — the floating cart button renders nothing while the basket is empty. That is
    // exactly what shipped for craft in the first cut of this change, and it was caught by a
    // screenshot run rather than by a test.
    render(
      <CategoryNav
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
