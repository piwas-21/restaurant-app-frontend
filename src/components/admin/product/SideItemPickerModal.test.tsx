import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import SideItemPickerModal from './SideItemPickerModal';
import { searchProducts, type ProductSearchResponse } from '@/services/productService';
import { ApiError } from '@/utils/apiClient';
import { SIDE_ITEM_SEARCH_DEBOUNCE_MS } from '@/hooks/admin/useSideItemSearch';
import type { SideItemDetails } from '@/hooks/admin/useSideItemDetails';

/**
 * The picker that can ADD and REMOVE (MENU-ITEM-EDITOR-REDESIGN-PLAN **D12**, slice S9).
 *
 * The surface this replaces merged (`[...selectedSideItemIds, ...tempSelectedIds]`), so an untick
 * inside it was a no-op and removal existed only as an `×` on a chip outside it. Every assertion
 * about removal below fails against that code — which is the point of naming them.
 *
 * MEASURED mutation signatures, by test NAME (counts decay as the suite grows; names do not):
 *
 * | mutation | what goes red |
 * |---|---|
 * | `apply` merges into `selectedSideItemIds` instead of replacing | `unticking an already-suggested item removes it` (+ two outside this file) |
 * | `listedIds` is derived from the live draft instead of a snapshot | `an unticked row stays on screen so it can be put back` |
 * | drop `resultsNotAlreadyListed` | `does not offer a second tick box for an item it already suggests` |
 * | `disabled={isSelf}` becomes `disabled={isSelf \|\| alreadyAdded}` — the ingredient library's treatment | `shows an already-suggested item TICKED, with the note that says why` |
 * | the self row becomes selectable | `will not let a dish suggest itself` |
 * | render the group heading unconditionally | `promises no match before a search has been run` |
 *
 * The search-state assertions at the bottom are PORTED, not new: they were written against the
 * inline expander and they hold the same lines. Deleting them with the old component would have
 * quietly given back the "no side items found" defect the type-ahead slice fixed.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

jest.mock('@/services/productService', () => ({ searchProducts: jest.fn() }));

const mockSearchProducts = searchProducts as jest.MockedFunction<typeof searchProducts>;

const FRIES = 'fries-id';
const SALAD = 'salad-id';
const COLA = 'cola-id';
const DISH = 'the-dish-being-edited';

const row = (id: string, name: string) => ({ id, name, description: '', basePrice: 4, type: 'addOn' });

const ok = (items: ReturnType<typeof row>[]) =>
  ({
    success: true,
    message: '',
    data: { items, totalCount: items.length, page: 1, pageSize: 20, totalPages: 1 },
  }) as unknown as ProductSearchResponse;

const details = (entries: [string, string][]): Map<string, SideItemDetails> =>
  new Map(entries.map(([id, name]) => [id, { name }]));

function renderPicker({
  selected = [] as string[],
  names = [] as [string, string][],
  productId = DISH as string | undefined,
} = {}) {
  const onApply = jest.fn();
  const onClose = jest.fn();
  render(
    <SideItemPickerModal
      selectedSideItemIds={selected}
      selectedItemsDetails={details(names)}
      onApply={onApply}
      onClose={onClose}
      productId={productId}
    />,
  );
  return { onApply, onClose };
}

const type = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('search_placeholder'), { target: { value: term } });

/** Walk past the debounce window and let the request's `.then` run. */
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(SIDE_ITEM_SEARCH_DEBOUNCE_MS);
  });
};

const search = async (term: string) => {
  type(term);
  await settle();
};

const box = (name: string) => screen.getByRole('checkbox', { name });
const apply = () => fireEvent.click(screen.getByRole('button', { name: 'apply' }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('SideItemPickerModal — it adds', () => {
  it('ticking a search result and applying suggests it, alongside what was already there', async () => {
    mockSearchProducts.mockResolvedValue(ok([row(FRIES, 'Fried Potatoes')]));
    const { onApply, onClose } = renderPicker({ selected: [COLA], names: [[COLA, 'Cola']] });

    await search('fried');
    fireEvent.click(box('Fried Potatoes'));
    apply();

    // The oracle is the two lists the component was GIVEN — the one already on the product and the
    // one row the server returned — not anything the component computed.
    expect(onApply).toHaveBeenCalledWith([COLA, FRIES]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not offer a second tick box for an item it already suggests', async () => {
    // The control that makes the assertion non-trivial: the SAME response also carries a row that
    // is NOT suggested, and that one must still appear.
    mockSearchProducts.mockResolvedValue(ok([row(COLA, 'Cola'), row(FRIES, 'Fried Potatoes')]));
    renderPicker({ selected: [COLA], names: [[COLA, 'Cola']] });

    await search('drink');

    expect(screen.getAllByRole('checkbox', { name: 'Cola' })).toHaveLength(1);
    expect(box('Cola')).toBeChecked();
    expect(box('Fried Potatoes')).not.toBeChecked();
  });

  it('shows an already-suggested item TICKED, with the note that says why', () => {
    // Ticked and dimmed, never unticked-and-disabled: unticked would read as "not selected", the
    // opposite of what is true. The ingredient library learned this as review gap G23 (#581); here
    // the row is also LIVE, because unticking it is the removal D12 is about.
    renderPicker({ selected: [COLA], names: [[COLA, 'Cola']] });

    const cola = box('Cola');
    expect(cola).toBeChecked();
    expect(cola).toBeEnabled();
    expect(screen.getByText('already_added')).toBeInTheDocument();
  });
});

describe('SideItemPickerModal — it removes, which is the whole of D12', () => {
  it('unticking an already-suggested item removes it', async () => {
    const { onApply } = renderPicker({
      selected: [COLA, SALAD],
      names: [
        [COLA, 'Cola'],
        [SALAD, 'Salad'],
      ],
    });

    fireEvent.click(box('Cola'));
    apply();

    // The control is `SALAD`: an implementation that simply returned `[]` — or one that merged, and
    // so returned both — fails on a different assertion from the one that catches the other.
    expect(onApply).toHaveBeenCalledWith([SALAD]);
  });

  it('an unticked row stays on screen so it can be put back', async () => {
    const { onApply } = renderPicker({ selected: [COLA], names: [[COLA, 'Cola']] });

    fireEvent.click(box('Cola'));
    expect(box('Cola')).not.toBeChecked();

    fireEvent.click(box('Cola'));
    expect(box('Cola')).toBeChecked();
    apply();

    // Back where it started, so Apply is refused: nothing changed.
    expect(onApply).not.toHaveBeenCalled();
  });

  it('holds Apply until something actually changes, so an opened-and-closed picker does not dirty the form', () => {
    renderPicker({ selected: [COLA], names: [[COLA, 'Cola']] });

    expect(screen.getByRole('button', { name: 'apply' })).toBeDisabled();
    fireEvent.click(box('Cola'));
    expect(screen.getByRole('button', { name: 'apply' })).toBeEnabled();
  });

  it('throws the draft away on Cancel', () => {
    const { onApply, onClose } = renderPicker({ selected: [COLA], names: [[COLA, 'Cola']] });

    fireEvent.click(box('Cola'));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SideItemPickerModal — a dish may not suggest itself', () => {
  it('will not let a dish suggest itself', async () => {
    // `searchProducts` matches the edited product like any other row and the backend stores what it
    // is sent, so this guard exists nowhere else.
    mockSearchProducts.mockResolvedValue(ok([row(DISH, 'Margherita'), row(FRIES, 'Fried Potatoes')]));
    renderPicker();

    await search('marg');

    expect(box('Margherita')).toBeDisabled();
    expect(box('Margherita')).not.toBeChecked();
    expect(screen.getByText('side_items_picker_self')).toBeInTheDocument();
    // The control: the other row in the same response is untouched.
    expect(box('Fried Potatoes')).toBeEnabled();
  });

  it('repairs a stored list that already holds the dish itself', () => {
    const { onApply } = renderPicker({
      selected: [DISH, COLA],
      names: [
        [DISH, 'Margherita'],
        [COLA, 'Cola'],
      ],
    });

    // Apply is offered even though nothing was ticked — the stored list is wrong and this is the
    // only screen that can put it right.
    apply();
    expect(onApply).toHaveBeenCalledWith([COLA]);
  });
});

describe('SideItemPickerModal — the search states, ported from the inline expander', () => {
  it('promises no match before a search has been run', () => {
    renderPicker();

    expect(screen.queryByText('side_items_picker_found')).not.toBeInTheDocument();
    expect(screen.getByText('side_items_picker_current')).toBeInTheDocument();
    expect(screen.getByText('no_side_items_selected')).toBeInTheDocument();
  });

  it('calls searchProducts WITH what was typed', async () => {
    mockSearchProducts.mockResolvedValue(ok([row(FRIES, 'Fried Potatoes')]));
    renderPicker();

    await search('fried potatoes');

    expect(mockSearchProducts).toHaveBeenCalledWith('fried potatoes');
    expect(screen.getByText('side_items_picker_found')).toBeInTheDocument();
  });

  it('does not claim an empty menu while a request is in flight', async () => {
    let resolve!: (value: ProductSearchResponse) => void;
    mockSearchProducts.mockReturnValue(new Promise<ProductSearchResponse>((r) => (resolve = r)));
    renderPicker();

    await search('fries');

    expect(screen.getByRole('status')).toHaveTextContent('searching');
    expect(screen.queryByText('no_side_items_found')).not.toBeInTheDocument();

    await act(async () => resolve(ok([])));
    expect(screen.getByText('no_side_items_found')).toBeInTheDocument();
  });

  it('shows the server’s reason and suppresses the empty state', async () => {
    mockSearchProducts.mockRejectedValue(new ApiError(503, 'Menu service is unavailable'));
    renderPicker();

    await search('fries');

    expect(screen.getByRole('alert')).toHaveTextContent('Menu service is unavailable');
    expect(screen.queryByText('no_side_items_found')).not.toBeInTheDocument();
  });

  it('keeps the currently-suggested group readable while a search is failing', async () => {
    mockSearchProducts.mockRejectedValue(new ApiError(503, 'Menu service is unavailable'));
    renderPicker({ selected: [COLA], names: [[COLA, 'Cola']] });

    await search('fries');

    // Removal must not depend on the search working: the group is a snapshot of the product, not a
    // result set.
    const lists = screen.getAllByRole('list');
    expect(within(lists[0]).getByRole('checkbox', { name: 'Cola' })).toBeChecked();
  });
});
