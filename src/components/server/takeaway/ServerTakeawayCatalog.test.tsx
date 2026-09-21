import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Product } from '@/services/serverService';
import ServerTakeawayCatalog from './ServerTakeawayCatalog';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const product = { id: 'p1', name: 'Espresso', basePrice: 3.5, isActive: true, isAvailable: true } as Product;
const props = (overrides: Record<string, unknown> = {}) => ({
  categories: [{ id: 'c1', name: 'Drinks' }],
  products: [product],
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

describe('ServerTakeawayCatalog', () => {
  it('states the product-only boundary and adds an item on one tap', () => {
    const onTapProduct = jest.fn();
    render(<ServerTakeawayCatalog {...props({ onTapProduct })} />);

    expect(screen.getByText('server.takeaway.product_only_note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'server.takeaway.add_product' }));
    expect(onTapProduct).toHaveBeenCalledWith(product);
  });

  it('keeps the search and category controls accessible', () => {
    const onSearchChange = jest.fn();
    render(<ServerTakeawayCatalog {...props({ onSearchChange })} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tea' } });
    expect(onSearchChange).toHaveBeenCalledWith('tea');
    expect(screen.getByRole('tablist', { name: 'server.takeaway.categories' })).toBeInTheDocument();
  });
});
