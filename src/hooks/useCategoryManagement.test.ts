import { act, renderHook, waitFor } from '@testing-library/react';
import { useCategoryManagement } from './useCategoryManagement';
import { getCategories, deleteCategory } from '@/services/categoryService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/categoryService');
// `t` is hoisted OUT of the factory on purpose. react-i18next memoises `t` and only changes its
// identity on a language change; a mock that mints a fresh function per render does not, and
// `fetchCategories` lists `t` in its dependency array — so a per-render mock turns the mount effect
// into an infinite refetch. That is a property of the mock, not of the hook, but it is the shape
// every other hook test in this repo uses, so it is worth naming where the next one will hit it.
const stableT = (key: string, fallback?: string) => fallback ?? key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockDeleteCategory = deleteCategory as jest.MockedFunction<typeof deleteCategory>;

const okList = { success: true, message: '', data: { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 1 } };

function renderLoaded() {
  const hook = renderHook(() => useCategoryManagement());
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCategories.mockResolvedValue(okList as never);
});

/**
 * E9 step 3 (#383). Every assertion here is about the SENTENCE that reaches the admin, not about
 * whether a catch has a binding — the ratchet already counts the latter and cannot see the former.
 */
describe('useCategoryManagement — what the admin actually reads', () => {
  it("surfaces the server's own sentence when the fetch throws", async () => {
    mockGetCategories.mockRejectedValue(new ApiError(409, 'Category tree is being rebuilt, try again shortly'));
    const { result } = renderLoaded();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Category tree is being rebuilt, try again shortly');
  });

  it('falls back to a CONTEXTUAL sentence, not the generic one, when the server authored none', async () => {
    mockGetCategories.mockRejectedValue(new ApiError(500, ''));
    const { result } = renderLoaded();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // The point of E9: "Failed to load categories" says where the admin is.
    expect(result.current.error).toBe('Failed to load categories');
    expect(result.current.error).not.toBe('An unexpected error occurred.');
  });

  it("keeps the server's sentence on the {success:false} shape too", async () => {
    mockGetCategories.mockResolvedValue({ success: false, message: 'Tenant module not enabled' } as never);
    const { result } = renderLoaded();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Tenant module not enabled');
  });

  /**
   * The bug this replaced: the hook returned i18n KEYS and `ResultModal` renders `message` raw
   * (`<p>{message}</p>`, no `t`), so a successful delete showed the admin the literal string
   * `category_deleted_successfully`.
   */
  it('returns a translated sentence from a delete, never a raw i18n key', async () => {
    mockDeleteCategory.mockResolvedValue({ success: true } as never);
    const { result } = renderLoaded();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let outcome: { success: boolean; message: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleDeleteCategory('c1');
    });

    expect(outcome).toEqual({ success: true, message: 'Category deleted successfully' });
    expect(outcome?.message).not.toMatch(/^[a-z0-9_]+$/);
  });

  it("prefers the server's per-rule errors[] over its flattened message on a refused delete", async () => {
    mockDeleteCategory.mockResolvedValue({
      success: false,
      message: 'Delete failed',
      errors: ['Category still has 4 products', 'Category is referenced by a bundle'],
    } as never);
    const { result } = renderLoaded();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let outcome: { success: boolean; message: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleDeleteCategory('c1');
    });

    expect(outcome?.message).toBe('Category still has 4 products, Category is referenced by a bundle');
  });

  it('surfaces a thrown delete failure as a translated sentence, not a key', async () => {
    mockDeleteCategory.mockRejectedValue(new ApiError(500, ''));
    const { result } = renderLoaded();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let outcome: { success: boolean; message: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleDeleteCategory('c1');
    });

    expect(outcome).toEqual({ success: false, message: 'An error occurred while deleting the category' });
  });

  /**
   * Regression guard for the shape this hook deliberately does NOT use. `useApiError` returns a new
   * object whenever its message changes, and `fetchCategories` is depended on by a mount effect —
   * so capturing into it would rebuild the callback, re-fire the effect and refetch forever. One
   * failed load must produce exactly one request.
   */
  it('does not retry in a loop when the first load fails', async () => {
    mockGetCategories.mockRejectedValue(new ApiError(500, 'down'));
    const { result } = renderLoaded();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockGetCategories).toHaveBeenCalledTimes(1);
  });
});
