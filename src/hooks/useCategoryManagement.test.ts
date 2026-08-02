import { act, renderHook, waitFor } from '@testing-library/react';
import { useCategoryManagement } from './useCategoryManagement';
import { getCategories, deleteCategory } from '@/services/categoryService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/categoryService');
/**
 * Two DISTINCT `t` functions with identical behaviour, switched by `mockLanguage`.
 *
 * This models react-i18next accurately: `t` is memoised and stable across re-renders, but its
 * identity DOES change on `languageChanged`. Flipping `mockLanguage` and re-rendering is therefore
 * a faithful language switch, and it is the only way to catch a `t` that has been listed in a
 * fetch callback's dependency array. A single hoisted `t` would make that bug invisible.
 */
const mockTranslators = [
  (key: string, fallback?: string) => fallback ?? key,
  (key: string, fallback?: string) => fallback ?? key,
];
let mockLanguage = 0;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslators[mockLanguage] }),
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
  mockLanguage = 0;
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
   * `getErrorMessage` returns `null` for anything that is not an `ApiError`, on purpose: a
   * `TypeError` from a dead network and a `SyntaxError` from an HTML 502 body would otherwise put
   * `Failed to fetch` and `Unexpected token '<'` in front of an admin. The contextual sentence must
   * win for those.
   */
  it('does not leak a raw non-ApiError throw to the screen', async () => {
    mockGetCategories.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderLoaded();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Failed to load categories');
    expect(result.current.error).not.toContain('Failed to fetch');
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

  /**
   * `t` is read through a ref rather than listed in `fetchCategories`'s deps. Listing it couples the
   * callback's identity to the i18n language — and the language switcher sits in the shared admin
   * chrome (`app-internal-layout`) — so a switch rebuilds the callback, re-fires the mount effect,
   * and refetches AT PAGE 1. An admin reading page 4 silently loses their place and pays a round
   * trip, for a list that does not vary by locale.
   */
  it('does not refetch or reset the page when the language changes', async () => {
    const { result, rerender } = renderLoaded();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.fetchCategories(4);
    });
    expect(result.current.currentPage).toBe(4);
    expect(mockGetCategories).toHaveBeenCalledTimes(2); // mount + the explicit page 4

    // A language switch: react-i18next hands back a NEW `t` with the same behaviour.
    await act(async () => {
      mockLanguage = 1;
      rerender();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(result.current.currentPage).toBe(4);
    expect(mockGetCategories).toHaveBeenCalledTimes(2);
  });
});
