import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CatalogItem } from '@/types/menu';
import { useOptionalAuth } from '@/components/AuthContext';
import { updateProductPrice } from '@/services/productService';
import AdminPriceEditor from './AdminPriceEditor';
// Resolves to `__mocks__/@/utils/apiClient.ts`, which shadows the real module tree-wide — the same
// class object the component's `getErrorMessage` checks with `instanceof`. Constructing one from
// anywhere else makes that check false and the assertion vacuous.
import { ApiError } from '@/utils/apiClient';

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
    priceEditability: 'editable',
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

  // The reported bug: this used to render NOTHING, so an admin could not tell a deliberate refusal
  // from a missing feature. It now always says something.
  it.each([
    ['variations', 'Price is set per variation'],
    ['bundle', "A combo's price comes from the items in it"],
  ] as const)('explains the refusal instead of vanishing when editability is %s', (editability, reason) => {
    asAdmin();
    render(<AdminPriceEditor item={product({ priceEditability: editability })} onPriceChange={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-edit-price-locked')).toHaveTextContent(reason);
  });

  // A combo used to reach the editor with `priceEditable: undefined`, which is also `!== true` —
  // same blank outcome, different cause. Pinned separately because the mapper is what changed.
  it('still renders nothing for a guest, whatever the editability', () => {
    render(<AdminPriceEditor item={product({ priceEditability: 'bundle' })} onPriceChange={jest.fn()} />);
    expect(screen.queryByTestId('admin-edit-price-locked')).not.toBeInTheDocument();
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

  /**
   * `updateProductPrice` goes through `apiClient`, which THROWS on any non-2xx. The catch was
   * unbound, so a rejected save turned the border red and said nothing — the same swallow as
   * BUGS-IMPROVEMENTS-PLAN E9, on a second surface.
   */
  it('shows the reason a save was rejected, not just a red border', async () => {
    asAdmin();
    (updateProductPrice as jest.Mock).mockRejectedValue(new ApiError(400, 'Price must be below 1000'));

    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '5000' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    expect(await screen.findByTestId('admin-price-error')).toHaveTextContent('Price must be below 1000');
    // The message is wired to the input, so it is announced rather than merely painted.
    expect(screen.getByTestId('admin-price-input')).toHaveAttribute(
      'aria-describedby',
      screen.getByTestId('admin-price-error').id,
    );
  });

  it('names the rule when the typed value is not a price', async () => {
    asAdmin();

    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    expect(await screen.findByTestId('admin-price-error')).toHaveTextContent('Enter a price of 0 or more');
    // Guarded locally, so the empty field never reaches the server as a free 0.00.
    expect(updateProductPrice).not.toHaveBeenCalled();
  });
});
