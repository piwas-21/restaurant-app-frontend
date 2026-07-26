import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useCategoryChannelsAdmin } from './useCategoryChannelsAdmin';
import { getCategories, updateCategory } from '@/services/categoryService';

jest.mock('@/services/categoryService');
jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }),
}));

const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockUpdateCategory = updateCategory as jest.MockedFunction<typeof updateCategory>;

const DURUM = { id: 'c1', name: 'Dürüm Wraps', isActive: true, displayOrder: 0, availableOrderTypes: null };
const GRILLS = { id: 'c2', name: 'Grills', isActive: true, displayOrder: 1, availableOrderTypes: 6 };

function mockList(items: unknown[]) {
  mockGetCategories.mockResolvedValue({ success: true, data: { items } } as never);
}

async function renderLoaded() {
  const hook = renderHook(() => useCategoryChannelsAdmin());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCategory.mockResolvedValue({ success: true } as never);
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

  it('save echoes name/isActive so the update cannot blank them, then clears dirty', async () => {
    mockList([GRILLS]);
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c2', OrderType.DineIn));
    await act(async () => {
      await result.current.save('c2');
    });

    expect(mockUpdateCategory).toHaveBeenCalledWith('c2', {
      id: 'c2',
      name: 'Grills',
      description: undefined,
      isActive: true,
      availableOrderTypes: null,
    });
    expect(result.current.isDirty('c2')).toBe(false);
  });

  it('a failed save leaves the row dirty so the edit is not silently lost', async () => {
    mockList([DURUM]);
    mockUpdateCategory.mockRejectedValue(new Error('boom'));
    const { result } = await renderLoaded();

    act(() => result.current.toggle('c1', OrderType.DineIn));
    await act(async () => {
      await result.current.save('c1');
    });

    expect(result.current.isDirty('c1')).toBe(true);
    expect(result.current.savingId).toBeNull();
  });

  it('a failed load leaves an empty list rather than throwing', async () => {
    mockGetCategories.mockRejectedValue(new Error('offline'));
    const { result } = await renderLoaded();

    expect(result.current.categories).toEqual([]);
  });
});
