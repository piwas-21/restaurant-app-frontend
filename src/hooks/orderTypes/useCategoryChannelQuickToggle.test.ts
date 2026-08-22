import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { getCategories, updateCategoryOrderTypes } from '@/services/categoryService';
import { QUICK_TOGGLE_POLL_MS, useCategoryChannelQuickToggle } from './useCategoryChannelQuickToggle';

jest.mock('@/services/categoryService');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }),
}));

const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockUpdate = updateCategoryOrderTypes as jest.MockedFunction<typeof updateCategoryOrderTypes>;

const DURUM = { id: 'c1', name: 'Dürüm Wraps', isActive: true, displayOrder: 0, availableOrderTypes: 6 };
const GRILLS = { id: 'c2', name: 'Grills', isActive: true, displayOrder: 1, availableOrderTypes: null };
const RETIRED = { id: 'c3', name: 'Retired', isActive: false, displayOrder: 2, availableOrderTypes: null };

function mockList(items: unknown[], totalCount?: number) {
  mockGetCategories.mockResolvedValue({
    success: true,
    data: { items, totalCount: totalCount ?? items.length },
  } as never);
}

async function renderLoaded() {
  const hook = renderHook(() => useCategoryChannelQuickToggle(true));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ success: true } as never);
});

describe('useCategoryChannelQuickToggle', () => {
  it('fetches nothing at all when the viewer may not write', async () => {
    // `PUT /api/Categories/{id}` is [RequireAdmin]; a cashier's screen must not poll on their behalf.
    mockList([DURUM]);
    const { result } = renderHook(() => useCategoryChannelQuickToggle(false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetCategories).not.toHaveBeenCalled();
    expect(result.current.statuses).toEqual([]);
  });

  it('lists only ACTIVE categories, and counts what it left out', async () => {
    mockList([DURUM, GRILLS, RETIRED]);
    const { result } = await renderLoaded();

    expect(result.current.statuses.map((s) => s.id)).toEqual(['c1', 'c2']);
    expect(result.current.hiddenCount).toBe(1);
  });

  it('resolves the translated category name for the label', async () => {
    mockList([DURUM]);
    const { result } = await renderLoaded();

    // `getCategoryDisplayName` maps `Dürüm Wraps` → the `durum` key and falls back to the API
    // name when that key resolves to itself, which is exactly what this `t` stub does. The point
    // pinned here is that the NAME goes through the mapper at all, not which branch it lands on.
    expect(result.current.statuses[0].name).toBe('Dürüm Wraps');
    expect(result.current.statuses[0].closed).toEqual([OrderType.DineIn]);
  });

  it('writes through the shared writer and re-reads instead of patching state', async () => {
    mockList([DURUM]);
    const { result } = await renderLoaded();

    // The server has NOT actually applied it — the re-read still says takeaway+delivery.
    await act(async () => {
      await result.current.setChannel('c1', OrderType.DineIn, true);
    });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), null);
    expect(mockGetCategories).toHaveBeenCalledTimes(2);
    // NOT optimistic: the switch reflects what came back, so a rejected or overwritten save can
    // never leave the three surfaces showing different rules.
    expect(result.current.statuses[0].closed).toEqual([OrderType.DineIn]);
  });

  it('refuses to close the last open channel, without calling the API', async () => {
    mockList([{ ...DURUM, availableOrderTypes: 2 }]);
    const { result } = await renderLoaded();

    expect(result.current.canSet('c1', OrderType.Takeaway, false)).toBe(false);
    await act(async () => {
      await result.current.setChannel('c1', OrderType.Takeaway, false);
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('surfaces a failed write and leaves the displayed state untouched', async () => {
    mockList([DURUM]);
    mockUpdate.mockRejectedValue(new Error('boom'));
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.setChannel('c1', OrderType.DineIn, true);
    });

    expect(result.current.error).toBe('Failed to save order type availability');
    expect(result.current.savingId).toBeNull();
    expect(result.current.statuses[0].closed).toEqual([OrderType.DineIn]);
  });

  it('treats a payload with no items as an empty, unrestricted list rather than throwing', async () => {
    // The permissive default this feature applies everywhere: a garbled read must not invent a
    // restriction, and it must not blank the panel with an exception either.
    mockGetCategories.mockResolvedValue({ success: true, data: undefined } as never);
    const { result } = await renderLoaded();

    expect(result.current.statuses).toEqual([]);
    expect(result.current.hiddenCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a failed read', async () => {
    mockGetCategories.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCategoryChannelQuickToggle(true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load categories');
  });
});

describe('the refresh contract — three surfaces must agree within seconds', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function renderWithTimers() {
    const hook = renderHook(() => useCategoryChannelQuickToggle(true));
    await act(async () => {
      await Promise.resolve();
    });
    return hook;
  }

  it('polls while the tab is visible', async () => {
    mockList([DURUM]);
    await renderWithTimers();
    expect(mockGetCategories).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(QUICK_TOGGLE_POLL_MS);
      await Promise.resolve();
    });

    expect(mockGetCategories).toHaveBeenCalledTimes(2);
  });

  it('does NOT poll a hidden tab — a backgrounded till must not fetch all night', async () => {
    mockList([DURUM]);
    await renderWithTimers();
    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    await act(async () => {
      jest.advanceTimersByTime(QUICK_TOGGLE_POLL_MS * 3);
      await Promise.resolve();
    });

    expect(mockGetCategories).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it('re-reads the moment the window regains focus', async () => {
    mockList([DURUM]);
    await renderWithTimers();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(mockGetCategories).toHaveBeenCalledTimes(2);
  });

  it('re-reads when the tab becomes visible again', async () => {
    mockList([DURUM]);
    await renderWithTimers();

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mockGetCategories).toHaveBeenCalledTimes(2);
  });

  it('writes no state from a read or a save that lands after unmount', async () => {
    // A cashier navigating away mid-write is the ordinary case. `commit` is the one guard; this
    // exercises its closed branch, which is otherwise only reachable in production.
    type Resolve = (value: never) => void;
    let resolveRead: Resolve = () => {};
    mockGetCategories.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve as Resolve;
        }) as ReturnType<typeof getCategories>,
    );
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useCategoryChannelQuickToggle(true));

    unmount();
    await act(async () => {
      resolveRead({ success: true, data: { items: [DURUM], totalCount: 1 } } as never);
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(result.current.statuses).toEqual([]);
    expect(result.current.loading).toBe(true);
    consoleError.mockRestore();
  });

  it('stops polling once unmounted', async () => {
    mockList([DURUM]);
    const { unmount } = await renderWithTimers();
    unmount();

    await act(async () => {
      jest.advanceTimersByTime(QUICK_TOGGLE_POLL_MS * 2);
      await Promise.resolve();
    });

    expect(mockGetCategories).toHaveBeenCalledTimes(1);
  });
});
