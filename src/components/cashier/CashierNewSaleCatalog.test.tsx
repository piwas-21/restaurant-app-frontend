import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CashierNewSaleCatalog from './CashierNewSaleCatalog';
import type { Product } from '@/services/serverService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const product = (overrides: Record<string, unknown> = {}): Product =>
  ({
    id: 'p1',
    name: 'Espresso',
    description: 'coffee',
    basePrice: 3.5,
    isActive: true,
    isAvailable: true,
    type: 'Product',
    ...overrides,
  }) as Product;

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  categories: [{ id: 'c1', name: 'Drinks' }],
  products: [product()] as readonly Product[],
  isLoading: false,
  error: null,
  selectedCategoryId: null,
  onSelectCategory: jest.fn(),
  searchQuery: '',
  onSearchChange: jest.fn(),
  onRetry: jest.fn(),
  tapPendingId: null,
  onTapProduct: jest.fn(),
  ...overrides,
});

describe('CashierNewSaleCatalog', () => {
  it('renders the category strip, search and product tiles', () => {
    render(<CashierNewSaleCatalog {...baseProps()} />);

    expect(screen.getByRole('tab', { name: 'cashier.new_sale.all_categories' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Drinks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cashier.new_sale.add_product' })).toBeInTheDocument();
  });

  it('marks the chosen category and reports the selection', () => {
    const onSelectCategory = jest.fn();
    render(<CashierNewSaleCatalog {...baseProps({ selectedCategoryId: 'c1', onSelectCategory })} />);

    expect(screen.getByRole('tab', { name: 'Drinks' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'cashier.new_sale.all_categories' }));
    expect(onSelectCategory).toHaveBeenCalledWith(null);
  });

  it('searches as the cashier types', () => {
    const onSearchChange = jest.fn();
    render(<CashierNewSaleCatalog {...baseProps({ onSearchChange })} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'esp' } });
    expect(onSearchChange).toHaveBeenCalledWith('esp');
  });

  it('taps a product tile to add it', () => {
    const onTapProduct = jest.fn();
    render(<CashierNewSaleCatalog {...baseProps({ onTapProduct })} />);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.add_product' }));
    expect(onTapProduct).toHaveBeenCalledWith(product());
  });

  it('shows the loading state instead of tiles', () => {
    render(<CashierNewSaleCatalog {...baseProps({ isLoading: true, products: [] })} />);

    expect(screen.getByText('cashier.new_sale.catalog_loading')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'cashier.new_sale.add_product' })).toBeNull();
  });

  it('shows the unavailable state with retry while the shelf is down', () => {
    const onRetry = jest.fn();
    render(<CashierNewSaleCatalog {...baseProps({ error: 'down', products: [], onRetry })} />);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the no-match state on an empty shelf', () => {
    render(<CashierNewSaleCatalog {...baseProps({ products: [] })} />);

    expect(screen.getByText('cashier.new_sale.no_products')).toBeInTheDocument();
  });

  it('disables a tile while its tap is pending', () => {
    render(<CashierNewSaleCatalog {...baseProps({ tapPendingId: 'p1' })} />);

    expect(screen.getByRole('button', { name: 'cashier.new_sale.add_product' })).toBeDisabled();
  });
});
