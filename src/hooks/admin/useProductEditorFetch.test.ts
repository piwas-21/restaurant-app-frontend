import { renderHook, waitFor } from '@testing-library/react';
import { useProductEditorFetch } from './useProductEditorFetch';
import { getProductById } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import { ApiError } from '@/utils/apiClient';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({ getMenuBundleById: jest.fn() }));

const mockProduct = getProductById as jest.Mock;
const mockBundle = getMenuBundleById as jest.Mock;

const PRODUCT = { id: 'p1', name: 'Mercimek', type: 'product' };
const BUNDLE = { id: 'b1', name: 'Lunch deal', type: 'menu' };

beforeEach(() => jest.clearAllMocks());

describe('useProductEditorFetch — why the product could not be opened (E9)', () => {
  it('prints the server’s reason from a 200-wrapped refusal, not its placeholder summary', async () => {
    // The path that actually fires. `ProductsController.GetProduct` returns `Ok(result)`
    // unconditionally, so `ApiResponse.Failure("Product not found")` arrives as 200 +
    // `success:false` and never throws — and that overload leaves `message` at the factory's
    // default, the literal "Operation failed". Reading `.message` printed the placeholder.
    mockProduct.mockResolvedValue({ success: false, message: 'Operation failed', errors: ['Product not found'] });
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.error).toBe('Product not found'));
    expect(result.current.error).not.toBe('Operation failed');
  });

  it('prints a THROWN refusal’s reason too — a 403 is not a missing product', async () => {
    mockProduct.mockRejectedValue(new ApiError(403, 'You do not manage this restaurant'));
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.error).toBe('You do not manage this restaurant'));
  });

  it('falls back to the translated sentence when the server authored none', async () => {
    // `ApiError(404, '')` — an empty server message, which is what `apiClient` throws when it
    // authored nothing itself. The translated key must win, not an empty error line.
    mockProduct.mockRejectedValue(new ApiError(404, ''));
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.error).toBe('product_not_found'));
  });

  it('re-fetches a bundle through the Menus endpoint, keyed off what came back', async () => {
    mockProduct.mockResolvedValue({ success: true, data: BUNDLE });
    mockBundle.mockResolvedValue({ success: true, data: { ...BUNDLE, schedule: '11:00' } });
    const { result } = renderHook(() => useProductEditorFetch('b1'));

    await waitFor(() => expect(result.current.product).toMatchObject({ id: 'b1', schedule: '11:00' }));
    expect(mockBundle).toHaveBeenCalledWith('b1');
  });

  it('does not make the extra request for a plain product', async () => {
    mockProduct.mockResolvedValue({ success: true, data: PRODUCT });
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.product).toEqual(PRODUCT));
    expect(mockBundle).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
