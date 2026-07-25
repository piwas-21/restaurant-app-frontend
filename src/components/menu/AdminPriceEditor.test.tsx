import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CatalogItem } from '@/types/menu';
import { useOptionalAuth } from '@/components/AuthContext';
import { updateProductPrice } from '@/services/productService';
import AdminPriceEditor from './AdminPriceEditor';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: jest.fn(() => null) }));
jest.mock('@/services/productService', () => ({ updateProductPrice: jest.fn() }));

const asAdmin = () => (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

const product = (over: Partial<CatalogItem> = {}): CatalogItem =>
  ({
    kind: 'product',
    id: 'p1',
    name: 'Margherita',
    price: 12.5,
    isBundle: false,
    priceEditable: true,
    ...over,
  }) as CatalogItem;

describe('AdminPriceEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOptionalAuth as jest.Mock).mockReturnValue(null);
  });

  it('renders nothing for a guest', () => {
    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
  });

  it('renders nothing when the price is derived (not priceEditable)', () => {
    asAdmin();
    render(<AdminPriceEditor item={product({ priceEditable: false })} onPriceChange={jest.fn()} />);
    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
  });

  it('shows a written label, not a bare glyph', () => {
    asAdmin();
    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    expect(screen.getByTestId('admin-edit-price')).toHaveTextContent('Edit price');
  });

  it('saves a new price and reports the backend-echoed value', async () => {
    asAdmin();
    (updateProductPrice as jest.Mock).mockResolvedValue({ success: true, data: 14 });
    const onPriceChange = jest.fn();

    render(<AdminPriceEditor item={product()} onPriceChange={onPriceChange} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));

    // Seeded from the current price, so an admin edits rather than retypes.
    const input = screen.getByTestId('admin-price-input');
    expect(input).toHaveValue(12.5);

    fireEvent.change(input, { target: { value: '13.99' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(updateProductPrice).toHaveBeenCalledWith('p1', 13.99));
    expect(onPriceChange).toHaveBeenCalledWith(14);
  });

  it('rejects a cleared field instead of retagging the item to 0.00', async () => {
    asAdmin();
    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));

    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(screen.getByTestId('admin-price-input')).toHaveAttribute('aria-invalid', 'true'));
    expect(updateProductPrice).not.toHaveBeenCalled();
  });

  it('keeps the editor open and flags the field when the save fails', async () => {
    asAdmin();
    (updateProductPrice as jest.Mock).mockResolvedValue({ success: false });
    const onPriceChange = jest.fn();

    render(<AdminPriceEditor item={product()} onPriceChange={onPriceChange} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(screen.getByTestId('admin-price-input')).toHaveAttribute('aria-invalid', 'true'));
    expect(onPriceChange).not.toHaveBeenCalled();
  });
});
