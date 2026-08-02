import { act, renderHook, waitFor } from '@testing-library/react';
import { useSpecialsManagement } from './useSpecialsManagement';
import { getSpecialProducts, setFeaturedSpecial, unsetFeaturedSpecial } from '@/services/productService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/productService');

// Stable `t` — see the note in `useCategoryManagement.test.ts`.
const mockStableT = (key: string, fallback?: string) => fallback ?? key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockStableT }) }));

const mockGetSpecials = getSpecialProducts as jest.MockedFunction<typeof getSpecialProducts>;
const mockSetFeatured = setFeaturedSpecial as jest.MockedFunction<typeof setFeaturedSpecial>;
const mockUnsetFeatured = unsetFeaturedSpecial as jest.MockedFunction<typeof unsetFeaturedSpecial>;

const emptyPage = { success: true, data: { items: [], totalCount: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSpecials.mockResolvedValue(emptyPage as never);
});

async function renderLoaded() {
  const hook = renderHook(() => useSpecialsManagement());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

/**
 * The specials page passes a FAILED result straight into `ResultModal`, which renders it raw. So
 * every string this hook returns on a failure path is a string the admin reads verbatim — in all
 * ten locales.
 */
describe('useSpecialsManagement — what the admin actually reads', () => {
  it("surfaces the server's own sentence when the list fetch throws", async () => {
    mockGetSpecials.mockRejectedValue(new ApiError(503, 'Specials index is rebuilding'));
    const { result } = renderHook(() => useSpecialsManagement());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Specials index is rebuilding');
  });

  it('falls back to a CONTEXTUAL sentence when the server authored none', async () => {
    mockGetSpecials.mockRejectedValue(new ApiError(500, ''));
    const { result } = renderHook(() => useSpecialsManagement());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Failed to load special items');
    expect(result.current.error).not.toBe('An unexpected error occurred while fetching special products');
  });

  it('returns a translated sentence when setting the featured special throws', async () => {
    mockSetFeatured.mockRejectedValue(new ApiError(500, ''));
    const { result } = await renderLoaded();

    let outcome: { success: boolean; message: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleSetFeaturedSpecial('p1');
    });

    expect(outcome).toEqual({ success: false, message: 'Failed to set the featured special' });
    expect(outcome?.message).not.toBe('An unexpected error occurred');
  });

  it("prefers the server's own sentence when setting the featured special is refused", async () => {
    mockSetFeatured.mockRejectedValue(new ApiError(409, 'Another item is already featured for today'));
    const { result } = await renderLoaded();

    let outcome: { success: boolean; message: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleSetFeaturedSpecial('p1');
    });

    expect(outcome?.message).toBe('Another item is already featured for today');
  });

  it('returns a translated sentence when removing the featured special throws', async () => {
    mockUnsetFeatured.mockRejectedValue(new ApiError(500, ''));
    const { result } = await renderLoaded();

    let outcome: { success: boolean; message: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleUnsetFeaturedSpecial();
    });

    expect(outcome).toEqual({ success: false, message: 'Failed to remove the featured special' });
  });

  it('does not retry in a loop when the first load fails', async () => {
    mockGetSpecials.mockRejectedValue(new ApiError(500, 'down'));
    const { result } = renderHook(() => useSpecialsManagement());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockGetSpecials).toHaveBeenCalledTimes(1);
  });
});
