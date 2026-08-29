import { act, renderHook, waitFor } from '@testing-library/react';
import { useMenuManagement } from './useMenuManagement';
import { getProducts } from '@/services/menuService';
import { getCategories } from '@/services/categoryService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/menuService');
jest.mock('@/services/categoryService');

const mockEnqueueSnackbar = jest.fn();
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }) }));

// Stable `t` — see the note in `useCategoryManagement.test.ts`.
const mockStableT = (key: string, fallback?: string) => fallback ?? key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockStableT }) }));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;
const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;

const emptyPage = {
  success: true,
  message: '',
  data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 1 },
  errors: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue(emptyPage as never);
  mockGetCategories.mockResolvedValue(emptyPage as never);
});

describe('useMenuManagement — what the admin actually reads', () => {
  it("surfaces the server's own sentence when the product fetch throws", async () => {
    mockGetProducts.mockRejectedValue(new ApiError(503, 'Menu service is restarting'));
    const { result } = renderHook(() => useMenuManagement('all'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Menu service is restarting');
  });

  it('falls back to a CONTEXTUAL sentence when the server authored none', async () => {
    mockGetProducts.mockRejectedValue(new ApiError(500, ''));
    const { result } = renderHook(() => useMenuManagement('all'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Failed to load menu items');
    expect(result.current.error).not.toBe('An unexpected error occurred.');
  });

  /**
   * The category dropdown gets a TOAST, not the page's error surface — replacing "here are your
   * items" with a failure about a filter would be a downgrade. Until #400 removed the mock
   * fallback this branch was unreachable, because `getCategories` answered a dead backend with
   * invented categories instead of throwing.
   */
  it('reports a failed category fetch as a toast and leaves the product list surface alone', async () => {
    mockGetCategories.mockRejectedValue(new ApiError(500, ''));
    const { result } = renderHook(() => useMenuManagement('all'));

    await waitFor(() => expect(mockEnqueueSnackbar).toHaveBeenCalled());
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to load categories', { variant: 'error' });
    // The products loaded fine, so the page must not be showing an error.
    expect(result.current.error).toBeNull();
    expect(result.current.categories).toEqual([]);
  });

  it("passes the server's sentence through the toast when it authored one", async () => {
    mockGetCategories.mockRejectedValue(new ApiError(403, 'Categories module is not enabled for this tenant'));
    renderHook(() => useMenuManagement('all'));

    await waitFor(() => expect(mockEnqueueSnackbar).toHaveBeenCalled());
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Categories module is not enabled for this tenant', {
      variant: 'error',
    });
  });

  it('does not leak a raw non-ApiError throw to the screen', async () => {
    mockGetProducts.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useMenuManagement('all'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Failed to load menu items');
    expect(result.current.error).not.toContain('Failed to fetch');
  });

  it('does not retry in a loop when the product load fails', async () => {
    mockGetProducts.mockRejectedValue(new ApiError(500, 'down'));
    const { result } = renderHook(() => useMenuManagement('all'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockGetProducts).toHaveBeenCalledTimes(1);
  });
});

/**
 * The OPTION-ONLY opt-in (frontend #631).
 *
 * `GET /api/Products` hides `isComponent` rows from every caller that does not ask, which is what
 * keeps a bundle's six meats off the guest menu. The admin catalog is one of exactly two callers
 * that must ask: without the opt-in, the moment an admin ticks "Option-only item" the row vanishes
 * from the only screen that could untick it.
 *
 * The channel asserted is the QUERY OBJECT handed to `getProducts` — the fourth argument, which is
 * where the service reads the flag. `menuService.test.ts` owns the other half, that the flag
 * becomes a query-string parameter.
 */
describe('useMenuManagement — the option-only opt-in', () => {
  const queryArg = (call: number) => mockGetProducts.mock.calls[call][3];

  // jsdom implements no scrolling, and `handlePageChange` smooth-scrolls to the top.
  beforeEach(() => {
    window.scrollTo = jest.fn();
  });

  it('asks for option-only items so a hidden item stays editable', async () => {
    renderHook(() => useMenuManagement('all'));

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
    expect(queryArg(0)).toEqual(expect.objectContaining({ includeComponents: true }));
  });

  /**
   * The opt-in must not displace the chip's own filter — they answer different questions, and the
   * bundles chip is where a conflated implementation would silently drop one of them.
   */
  it('keeps the type chip alongside it', async () => {
    renderHook(() => useMenuManagement('bundles'));

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
    expect(queryArg(0)).toEqual({ type: 'Menu', includeComponents: true });
  });

  it('asks on the items chip too, where the query is otherwise empty', async () => {
    renderHook(() => useMenuManagement('items'));

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
    expect(queryArg(0)).toEqual({ includeComponents: true });
  });

  it('keeps asking on a page change, not only on the first load', async () => {
    const { result } = renderHook(() => useMenuManagement('all'));
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());

    await act(async () => result.current.handlePageChange(2));

    const lastCall = mockGetProducts.mock.calls.length - 1;
    expect(mockGetProducts.mock.calls[lastCall][0]).toBe(2);
    expect(queryArg(lastCall)).toEqual(expect.objectContaining({ includeComponents: true }));
  });
});
