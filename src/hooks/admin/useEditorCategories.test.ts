import { act, renderHook, waitFor } from '@testing-library/react';
import { getCategories } from '@/services/categoryService';
import { useEditorCategories } from './useEditorCategories';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/services/categoryService', () => ({ getCategories: jest.fn() }));

const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
type CategoriesResponse = Awaited<ReturnType<typeof getCategories>>;

const CATEGORY = {
  id: 'category-1',
  name: 'Lunch dishes',
  isActive: true,
  displayOrder: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useEditorCategories — the category control must explain its load state', () => {
  it('loads category items and clears any previous error', async () => {
    mockGetCategories.mockResolvedValue({ success: true, data: { items: [CATEGORY] } } as never);
    const { result } = renderHook(() => useEditorCategories(false));

    await waitFor(() => expect(result.current.categories).toEqual([CATEGORY]));
    expect(result.current.categoriesError).toBeNull();
    expect(mockGetCategories).toHaveBeenCalledTimes(1);
  });

  it('treats a successful response without data as an empty list', async () => {
    mockGetCategories.mockResolvedValue({ success: true, data: undefined } as never);
    const { result } = renderHook(() => useEditorCategories(true));

    await waitFor(() => expect(mockGetCategories).toHaveBeenCalledTimes(1));
    expect(result.current.categories).toEqual([]);
    expect(result.current.categoriesError).toBeNull();
  });

  it('surfaces a resolved server refusal rather than silently showing an empty editor', async () => {
    mockGetCategories.mockResolvedValue({
      success: false,
      message: 'Categories could not be loaded',
      errors: ['Categories could not be loaded'],
      data: undefined,
    } as never);
    const { result } = renderHook(() => useEditorCategories(false));

    await waitFor(() => expect(result.current.categoriesError).toBe('Categories could not be loaded'));
    expect(result.current.categories).toEqual([]);
  });

  it('surfaces a thrown request failure with the translated contextual fallback', async () => {
    mockGetCategories.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useEditorCategories(false));

    await waitFor(() => expect(result.current.categoriesError).toBe('Failed to load categories'));
    expect(result.current.categories).toEqual([]);
  });

  it('does not write a resolved response after the editor unmounts', async () => {
    let resolveCategories: ((value: CategoriesResponse | PromiseLike<CategoriesResponse>) => void) | undefined;
    mockGetCategories.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCategories = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useEditorCategories(false));

    unmount();
    await act(async () => {
      resolveCategories?.({ success: true, data: { items: [CATEGORY] } } as CategoriesResponse);
      await Promise.resolve();
    });

    // React keeps the hook result available after unmount, which lets this assert the stale guard
    // without relying on a warning (warnings are not a correctness oracle in React 19).
    expect(result.current.categories).toEqual([]);
    expect(result.current.categoriesError).toBeNull();
  });

  it('does not capture a failure after the editor unmounts', async () => {
    let rejectCategories: ((reason?: unknown) => void) | undefined;
    mockGetCategories.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCategories = reject;
        }),
    );
    const { result, unmount } = renderHook(() => useEditorCategories(true));

    unmount();
    await act(async () => {
      rejectCategories?.(new Error('offline after navigation'));
      await Promise.resolve();
    });

    expect(result.current.categories).toEqual([]);
    expect(result.current.categoriesError).toBeNull();
  });

  it('reloads when the item kind changes, keeping bundle and item editors in sync', async () => {
    mockGetCategories.mockResolvedValue({ success: true, data: { items: [CATEGORY] } } as never);
    const { rerender } = renderHook(({ isBundle }) => useEditorCategories(isBundle), {
      initialProps: { isBundle: false },
    });

    await waitFor(() => expect(mockGetCategories).toHaveBeenCalledTimes(1));
    rerender({ isBundle: true });
    await waitFor(() => expect(mockGetCategories).toHaveBeenCalledTimes(2));
  });
});
