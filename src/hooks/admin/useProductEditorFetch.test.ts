import { act, renderHook, waitFor } from '@testing-library/react';
import { useProductEditorFetch } from './useProductEditorFetch';
import { getProductById } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import { ApiError } from '@/utils/apiClient';

const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
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
    expect(mockBundle.mock.calls.some(([id]) => id === 'b1')).toBe(true);
  });

  it('does not make the extra request for a plain product', async () => {
    mockProduct.mockResolvedValue({ success: true, data: PRODUCT });
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.product).toEqual(PRODUCT));
    expect(mockBundle).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('keeps the newest product when an older request resolves last', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    let resolveSecond: ((value: unknown) => void) | undefined;
    mockProduct.mockImplementation(
      (id: string) =>
        new Promise((resolve) => {
          if (id === 'p1') resolveFirst = resolve;
          if (id === 'p2') resolveSecond = resolve;
        }),
    );
    const { result, rerender } = renderHook(({ id }) => useProductEditorFetch(id), { initialProps: { id: 'p1' } });
    rerender({ id: 'p2' });

    resolveSecond?.({ success: true, data: { ...PRODUCT, id: 'p2' } });
    await waitFor(() => expect(result.current.product?.id).toBe('p2'));
    resolveFirst?.({ success: true, data: { ...PRODUCT, id: 'p1' } });
    await Promise.resolve();
    expect(result.current.product?.id).toBe('p2');
  });

  it('keeps product categories and primary placement when the bundle DTO omits them', async () => {
    mockProduct.mockResolvedValue({
      success: true,
      data: {
        ...BUNDLE,
        categories: [{ categoryId: 'cat-1', categoryName: 'Lunch', isPrimary: true }],
        primaryCategory: { id: 'cat-1', name: 'Lunch' },
      },
    });
    mockBundle.mockResolvedValue({ success: true, data: { ...BUNDLE, schedule: '11:00', categories: [] } });
    const { result } = renderHook(() => useProductEditorFetch('b1'));

    await waitFor(() => expect(result.current.product?.primaryCategory).toEqual({ id: 'cat-1', name: 'Lunch' }));
    expect(result.current.product?.categories).toEqual([
      { categoryId: 'cat-1', categoryName: 'Lunch', isPrimary: true },
    ]);
  });

  it('does not start a request when the route has no product id', () => {
    const { result } = renderHook(() => useProductEditorFetch(''));

    // An empty id can occur for one render while the dynamic route is hydrating. The guard must
    // leave the service untouched rather than issuing GET /api/Products/ and turning that transient
    // state into a visible "not found" error.
    expect(mockProduct).not.toHaveBeenCalled();
    expect(result.current.product).toBeNull();
  });

  it('handles a bundle endpoint refusal that resolves inside a successful transport response', async () => {
    mockProduct.mockResolvedValue({ success: true, data: BUNDLE });
    mockBundle.mockResolvedValue({ success: false, errors: ['Bundle is no longer available'] });
    const { result } = renderHook(() => useProductEditorFetch('b1'));

    // MenusController normally throws for this case, but the resolved refusal shape is still a
    // valid API contract and must not leave the editor spinning with an empty product.
    await waitFor(() => expect(result.current.error).toBe('Bundle is no longer available'));
    expect(result.current.product).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('uses the translated fallback when a successful product response omits its data', async () => {
    mockProduct.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.error).toBe('product_not_found'));
    expect(mockBundle).not.toHaveBeenCalled();
  });

  it('aborts the in-flight request on unmount and ignores its late answer', async () => {
    let resolveProduct: ((value: unknown) => void) | undefined;
    let signal: AbortSignal | undefined;
    mockProduct.mockImplementation((_id: string, requestSignal?: AbortSignal) => {
      signal = requestSignal;
      return new Promise((resolve) => {
        resolveProduct = resolve;
      });
    });
    const { result, unmount } = renderHook(() => useProductEditorFetch('p1'));

    unmount();
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      resolveProduct?.({ success: true, data: PRODUCT });
      await Promise.resolve();
    });
    expect(result.current.product).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ignores abort-shaped failures instead of displaying a product error', async () => {
    mockProduct.mockRejectedValue(new DOMException('request cancelled', 'AbortError'));
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it.each([{ name: 'AbortError' }, { cause: { name: 'AbortError' } }])(
    'recognises an abort-shaped plain error (%s)',
    async (abortError) => {
      mockProduct.mockRejectedValue(abortError);
      const { result } = renderHook(() => useProductEditorFetch('p1'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeNull();
    },
  );

  it('cancels the previous controller when an explicit refetch starts', async () => {
    mockProduct.mockResolvedValueOnce({ success: true, data: PRODUCT }).mockResolvedValueOnce({
      success: true,
      data: { ...PRODUCT, name: 'Updated product' },
    });
    const { result } = renderHook(() => useProductEditorFetch('p1'));

    await waitFor(() => expect(result.current.product).toEqual(PRODUCT));
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.product?.name).toBe('Updated product');
    expect(mockProduct).toHaveBeenCalledTimes(2);
  });
});
