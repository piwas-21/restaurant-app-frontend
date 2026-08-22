import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useCategoryChannelsAdmin, CATEGORY_PAGE_SIZE } from './useCategoryChannelsAdmin';
import { getCategories, updateCategoryOrderTypes } from '@/services/categoryService';

jest.mock('@/services/categoryService');
jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }),
}));

const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockUpdate = updateCategoryOrderTypes as jest.MockedFunction<typeof updateCategoryOrderTypes>;

const DURUM = { id: 'c1', name: 'Dürüm Wraps', isActive: true, displayOrder: 0, availableOrderTypes: null };
const GRILLS = { id: 'c2', name: 'Grills', isActive: true, displayOrder: 1, availableOrderTypes: 6 };

function mockList(items: unknown[]) {
  mockGetCategories.mockResolvedValue({ success: true, data: { items, totalCount: items.length } } as never);
}

async function renderLoaded() {
  const hook = renderHook(() => useCategoryChannelsAdmin());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ success: true } as never);
});

describe('useCategoryChannelsAdmin', () => {
  it('decodes a stored mask into the selected order types', async () => {
    mockList([DURUM, GRILLS]);
    const { result } = await renderLoaded();

    // null = unrestricted, so every type is selected.
    expect(result.current.selectedTypes(result.current.categories[0])).toEqual([
      OrderType.DineIn,
      OrderType.Takeaway,
      OrderType.Delivery,
    ]);
    // 6 = takeaway|delivery — the Dürüm case the client asked for.
    expect(result.current.selectedTypes(result.current.categories[1])).toEqual([
      OrderType.Takeaway,
      OrderType.Delivery,
    ]);
  });

  it('toggling off a type makes the row dirty and encodes the remaining mask', async () => {
    mockList([DURUM]);
    const { result } = await renderLoaded();

    expect(result.current.isDirty('c1')).toBe(false);
    act(() => result.current.toggle('c1', OrderType.DineIn));

    expect(result.current.isDirty('c1')).toBe(true);
    expect(result.current.categories[0].availableOrderTypes).toBe(6);
  });

  it('toggling a type off then back on normalises to null and is NOT dirty again', async () => {
    // The point of collapsing a full set to null: a row returned to unrestricted must not look
    // edited, even though it round-tripped through an explicit mask.
    mockList([DURUM]);
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c1', OrderType.DineIn));
    expect(result.current.categories[0].availableOrderTypes).toBe(6);
    expect(result.current.isDirty('c1')).toBe(true);

    act(() => result.current.toggle('c1', OrderType.DineIn));
    expect(result.current.categories[0].availableOrderTypes).toBeNull();
    expect(result.current.isDirty('c1')).toBe(false);
  });

  it('allows clearing every box, which is off-sale rather than unrestricted', async () => {
    mockList([GRILLS]);
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c2', OrderType.Takeaway));
    act(() => result.current.toggle('c2', OrderType.Delivery));

    // 0, not null — the two mean opposite things.
    expect(result.current.categories[0].availableOrderTypes).toBe(0);
    expect(result.current.selectedTypes(result.current.categories[0])).toEqual([]);
  });

  it('reset restores only the touched row', async () => {
    mockList([DURUM, GRILLS]);
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c1', OrderType.DineIn));
    act(() => result.current.toggle('c2', OrderType.Takeaway));
    act(() => result.current.reset('c1'));

    expect(result.current.isDirty('c1')).toBe(false);
    expect(result.current.isDirty('c2')).toBe(true);
  });

  it('saves through the shared writer, handing it the whole row, then clears dirty', async () => {
    // The §9.1 echo itself is pinned on `updateCategoryOrderTypes` in `categoryService.test.ts` —
    // there is one writer now, so the payload is asserted once, where it is built.
    mockList([GRILLS]);
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c2', OrderType.DineIn));
    await act(async () => {
      await result.current.save('c2');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c2', name: 'Grills', isActive: true }),
      null,
    );
    expect(result.current.isDirty('c2')).toBe(false);
  });

  it('a failed save leaves the row dirty so the edit is not silently lost', async () => {
    mockList([DURUM]);
    mockUpdate.mockRejectedValue(new Error('boom'));
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c1', OrderType.DineIn));
    await act(async () => {
      await result.current.save('c1');
    });

    expect(result.current.isDirty('c1')).toBe(true);
    expect(result.current.savingId).toBeNull();
  });

  // The API rejects mask 0 (`ValidOrderChannelMask`: null or 1..7), so offering Save on an empty
  // selection would just 400 with a generic toast and no way to tell why.
  it('refuses to save an empty selection, while still allowing it as an intermediate state', async () => {
    mockList([GRILLS]);
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c2', OrderType.Takeaway));
    act(() => result.current.toggle('c2', OrderType.Delivery));

    expect(result.current.selectedTypes(result.current.categories[0])).toEqual([]);
    expect(result.current.isDirty('c2')).toBe(true);
    expect(result.current.canSave('c2')).toBe(false);

    // Re-tick one channel and the commit is available again.
    act(() => result.current.toggle('c2', OrderType.DineIn));
    expect(result.current.canSave('c2')).toBe(true);
  });

  it('canSave is false for a clean row even when its mask is storable', async () => {
    mockList([GRILLS]);
    const { result } = await renderLoaded();

    expect(result.current.canSave('c2')).toBe(false);
  });

  it('a failed load leaves an empty list rather than throwing', async () => {
    mockGetCategories.mockRejectedValue(new Error('offline'));
    const { result } = await renderLoaded();

    expect(result.current.categories).toEqual([]);
  });
});

describe('useCategoryChannelsAdmin — the page cap is visible (§9.8)', () => {
  it('does not cry wolf when the server returned everything', async () => {
    const hook = await renderLoaded();

    expect(hook.result.current.truncated).toBe(false);
  });

  it('reports truncation when the server holds more than one page', async () => {
    // Silent truncation means a restriction is simply UNSETTABLE for the categories that fell off,
    // with nothing on screen to explain their absence.
    mockGetCategories.mockResolvedValue({
      success: true,
      data: { items: [{ id: 'c1', name: 'Grills', availableOrderTypes: null }], totalCount: 250 },
    } as never);

    const hook = renderHook(() => useCategoryChannelsAdmin());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(hook.result.current.truncated).toBe(true);
  });

  it('assumes completeness when the server omits a count, rather than warning on every load', async () => {
    mockGetCategories.mockResolvedValue({
      success: true,
      data: { items: [{ id: 'c1', name: 'Grills', availableOrderTypes: null }] },
    } as never);

    const hook = renderHook(() => useCategoryChannelsAdmin());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(hook.result.current.truncated).toBe(false);
  });

  it('does NOT warn on a catalogue of exactly one full page — the reason the predicate is not items.length === PAGE_SIZE', () => {
    // Pins the design rationale itself. Without this, refactoring to the simpler-looking
    // `items.length === CATEGORY_PAGE_SIZE` predicate passes every other test while crying wolf on
    // a complete catalogue.
    const items = Array.from({ length: CATEGORY_PAGE_SIZE }, (_, i) => ({
      id: `c${i}`,
      name: `Category ${i}`,
      availableOrderTypes: null,
    }));
    mockGetCategories.mockResolvedValue({
      success: true,
      data: { items, totalCount: CATEGORY_PAGE_SIZE },
    } as never);

    const hook = renderHook(() => useCategoryChannelsAdmin());

    return waitFor(() => expect(hook.result.current.loading).toBe(false)).then(() => {
      expect(hook.result.current.truncated).toBe(false);
    });
  });
});
