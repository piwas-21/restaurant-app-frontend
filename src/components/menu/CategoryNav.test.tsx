import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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
