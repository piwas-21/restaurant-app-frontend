import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CashierNewSaleWorkspace from './CashierNewSaleWorkspace';
import { useCashierNewSale } from '@/hooks/cashier/useCashierNewSale';
import { useCashierCatalog } from '@/hooks/cashier/useCashierCatalog';
import { OrderType, type OrderDto } from '@/types/order';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';

jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({
  useEnabledOrderTypes: () => ({ enabled: ['DineIn', 'Takeaway', 'Delivery'], loading: false }),
}));
jest.mock('@/hooks/cashier/useCashierNewSale', () => ({ useCashierNewSale: jest.fn() }));
jest.mock('@/hooks/cashier/useCashierCatalog', () => ({ useCashierCatalog: jest.fn() }));
jest.mock('@/hooks/cashier/useCashierOrderRoute', () => ({
  useCashierOrderRoute: () => ({ navigateToCollection: jest.fn() }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('next/navigation', () => ({ usePathname: () => '/cashier/new' }));
jest.mock('@/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('@/components/LanguageSwitcher', () => ({
  __esModule: true,
  default: () => <button type="button">Language</button>,
}));
jest.mock('@/components/ThemeSwitcher', () => ({
  __esModule: true,
  default: () => <button type="button">Theme</button>,
}));
jest.mock('@/components/UserMenu', () => ({ __esModule: true, default: () => <button type="button">User</button> }));
jest.mock('@/components/branding/TenantLogo', () => ({ __esModule: true, default: () => <span>Tenant</span> }));
jest.mock('@/hooks/useRestaurantInfo', () => ({ useRestaurantInfo: () => ({ info: null }) }));
jest.mock('@/hooks/cashier/useCashierOperationalCount', () => ({
  useCashierOperationalCount: () => ({
    count: 0,
    state: 'ready',
    isLoading: false,
    error: null,
    statusMessageKey: 'cashier.workspace.open_count_current',
    refreshCount: jest.fn(),
  }),
}));
jest.mock('@/components/catalog/ProductCustomization', () => ({
  __esModule: true,
  default: () => <div data-testid="customization-sheet" />,
}));

const mockSale = useCashierNewSale as jest.Mock;
const mockCatalog = useCashierCatalog as jest.Mock;

const line: CashierNewSaleDraftLine = {
  product: { id: 'p1', name: 'Espresso' },
  quantity: 2,
  unitPrice: 3.5,
  selectedIngredientIds: [],
};

const quote: Partial<OrderDto> = { id: 'q-1', total: 7 };

function saleState(overrides: Record<string, unknown> = {}) {
  return {
    channel: OrderType.Takeaway,
    channelsEnabled: [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery],
    channelsLoading: false,
    lines: [] as CashierNewSaleDraftLine[],
    notes: '',
    tableNumber: '',
    ticketTotal: 0,
    quote: null,
    phase: 'idle',
    error: null,
    sheetProduct: null,
    tapPendingId: null,
    lastRemoved: null,
    setChannel: jest.fn(),
    setNotes: jest.fn(),
    setTableNumber: jest.fn(),
    setLineQuantity: jest.fn(),
    removeLine: jest.fn(),
    undoRemove: jest.fn(),
    tapProduct: jest.fn(),
    confirmCustomization: jest.fn(),
    closeSheet: jest.fn(),
    review: jest.fn(),
    ...overrides,
  };
}

const catalogState = (overrides: Record<string, unknown> = {}) => ({
  categories: [{ id: 'c1', name: 'Drinks' }],
  products: [],
  isLoading: false,
  error: null,
  selectedCategoryId: null,
  setSelectedCategoryId: jest.fn(),
  searchQuery: '',
  setSearchQuery: jest.fn(),
  retry: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  mockSale.mockReturnValue(saleState());
  mockCatalog.mockReturnValue(catalogState());
});

describe('CashierNewSaleWorkspace', () => {
  it('renders the channel bar, catalog and ticket panes', () => {
    render(<CashierNewSaleWorkspace />);

    expect(screen.getByRole('radio', { name: 'order_type_takeaway' })).toBeChecked();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('cashier.new_sale.ticket_label')).toBeInTheDocument();
  });

  it('does not expose Review & collect on an empty ticket', () => {
    render(<CashierNewSaleWorkspace />);

    expect(screen.getByRole('button', { name: 'cashier.new_sale.review_and_collect' })).toBeDisabled();
  });

  it('reviews from the ticket and shows the reviewing phase while in flight', () => {
    const review = jest.fn();
    mockSale.mockReturnValue(saleState({ lines: [line], ticketTotal: 7, review }));
    render(<CashierNewSaleWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.review_and_collect' }));
    expect(review).toHaveBeenCalledTimes(1);

    mockSale.mockReturnValue(saleState({ lines: [line], ticketTotal: 7, phase: 'reviewing', review }));
    render(<CashierNewSaleWorkspace />);
    expect(screen.getByRole('button', { name: 'cashier.new_sale.reviewing' })).toBeDisabled();
  });

  it('shows the server total once a quote exists, and the refusal sentence otherwise', () => {
    mockSale.mockReturnValue(saleState({ lines: [line], ticketTotal: 7, quote: quote as OrderDto }));
    const { unmount } = render(<CashierNewSaleWorkspace />);
    expect(screen.getByText('cashier.new_sale.total_label')).toBeInTheDocument();
    unmount();

    mockSale.mockReturnValue(saleState({ error: 'Product X is not available for this channel.' }));
    render(<CashierNewSaleWorkspace />);
    expect(screen.getByRole('alert')).toHaveTextContent('Product X is not available for this channel.');
  });

  it('renders an i18n-keyed refusal through the locale, not the raw key', () => {
    mockSale.mockReturnValue(saleState({ error: 'cashier.new_sale.no_open_session' }));
    render(<CashierNewSaleWorkspace />);

    expect(screen.getByRole('alert')).toHaveTextContent('cashier.new_sale.no_open_session');
  });

  it('opens the shared customization sheet when a product has choices', () => {
    mockSale.mockReturnValue(saleState({ sheetProduct: { id: 'p1', name: 'Burger', basePrice: 12 } as never }));
    render(<CashierNewSaleWorkspace />);

    expect(screen.getByTestId('customization-sheet')).toBeInTheDocument();
  });

  it('offers undo while a removal is pending', async () => {
    const undoRemove = jest.fn();
    mockSale.mockReturnValue(
      saleState({
        lines: [line],
        ticketTotal: 7,
        lastRemoved: { line, index: 0 },
        undoRemove,
      }),
    );
    render(<CashierNewSaleWorkspace />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'cashier.new_sale.undo' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.undo' }));
    expect(undoRemove).toHaveBeenCalledTimes(1);
  });
});
