import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { SuggestedSideItemsPicker } from './SuggestedSideItemsPicker';
import { searchProducts, type ProductSearchResponse } from '@/services/productService';
import { getProductById } from '@/services/menuService';
import { ApiError } from '@/utils/apiClient';
import { SIDE_ITEM_SEARCH_DEBOUNCE_MS } from '@/hooks/admin/useSideItemSearch';

/**
 * Two DISTINCT `t` functions behind a mutable holder, not one hoisted arrow.
 *
 * react-i18next memoises `t`, so its identity is stable across ordinary re-renders and changes only
 * on `languageChanged`. A single hoisted `t` is stable in BOTH dimensions and therefore certifies
 * the bug `useStableT` exists to prevent — a mock that agrees with you. Swapping these two is what
 * makes the `[idKey, tRef]` dependency array testable at all.
 */
const mockTEn = (key: string, fallback?: string) => fallback ?? key;
const mockTDe = (key: string, fallback?: string) => fallback ?? key;
let mockCurrentT: typeof mockTEn = mockTEn;

// `t: mockCurrentT` — the reference itself, NOT an arrow wrapping it. An arrow would be a fresh
// identity on every render, which is unstable in both dimensions and pins nothing either.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockCurrentT }),
}));

jest.mock('@/services/productService', () => ({ searchProducts: jest.fn() }));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

const mockSearchProducts = searchProducts as jest.MockedFunction<typeof searchProducts>;
const mockGetProductById = getProductById as jest.MockedFunction<typeof getProductById>;

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentT = mockTEn;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** `<Controller>` needs a real `control`, so the picker is mounted inside a throwaway form. */
function Harness({ selectedSideItemIds = [] as string[] }) {
  const { control, formState } = useForm({ defaultValues: { suggestedSideItemIds: '' } });
  // `SuggestedSideItemsPickerProps` types both `errors` and `control` as `any` (pre-existing debt
  // in `product/types.ts`), so no cast is needed here.
  return (
    <SuggestedSideItemsPicker
      errors={formState.errors}
      control={control}
      selectedSideItemIds={selectedSideItemIds}
      onChange={() => {}}
    />
  );
}

const row = (id: string, name: string) => ({ id, name, description: '', basePrice: 4, type: 'mainItem' });

const ok = (items: ReturnType<typeof row>[]) =>
  ({
    success: true,
    message: '',
    data: { items, totalCount: items.length, page: 1, pageSize: 20, totalPages: 1 },
  }) as unknown as ProductSearchResponse;

/** A promise the test resolves by hand — the only way to have two searches genuinely in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// These call sites pass no `t()` fallback, so the mock yields the raw key as the label.
const openPicker = () => fireEvent.click(screen.getByRole('button', { name: 'add_side_items' }));
const type = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('search_placeholder'), { target: { value: term } });

/** Walk past the debounce window and let the request's `.then` run. */
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(SIDE_ITEM_SEARCH_DEBOUNCE_MS);
  });
};

const search = async (term: string) => {
  openPicker();
  type(term);
  await settle();
};

describe('SuggestedSideItemsPicker — the term reaches the server', () => {
  beforeEach(() => jest.useFakeTimers());

  it('calls searchProducts WITH what was typed', async () => {
    // THE assertion whose absence let this ship: the old code called `getProducts(1, 20)` with no
    // term at all and filtered the first page in the browser, so "searched and found nothing" and
    // "never searched" rendered identically and CI stayed green.
    mockSearchProducts.mockResolvedValue(ok([row('1', 'Fried Potatoes')]));

    render(<Harness />);
    await search('fried potatoes');

    expect(mockSearchProducts).toHaveBeenCalledWith('fried potatoes');
    expect(screen.getByText('Fried Potatoes')).toBeInTheDocument();
  });

  it('says nothing below the minimum length and asks once for a word typed in one burst', async () => {
    mockSearchProducts.mockResolvedValue(ok([row('1', 'Fries')]));

    render(<Harness />);
    openPicker();
    type('f');
    await settle();
    expect(mockSearchProducts).not.toHaveBeenCalled();

    await act(async () => {
      for (const term of ['fr', 'fri', 'frie', 'fries']) {
        type(term);
        jest.advanceTimersByTime(50);
      }
    });
    await settle();

    expect(mockSearchProducts).toHaveBeenCalledTimes(1);
    expect(mockSearchProducts).toHaveBeenCalledWith('fries');
  });

  it('keeps a row the server matched on its LOCALISED name', async () => {
    // `GetProductsQuery` also matches `p.Descriptions.Any(c => c.Name...)`, so a Turkish search can
    // return a row whose `name` does not contain the term. The client-side `.filter(p =>
    // p.name.includes(needle))` this replaces threw exactly those rows away — the fix would have
    // gone on failing for the tenant who needed it.
    mockSearchProducts.mockResolvedValue(ok([row('1', 'Fried Potatoes')]));

    render(<Harness />);
    await search('patates');

    expect(screen.getByText('Fried Potatoes')).toBeInTheDocument();
    expect(screen.queryByText('no_side_items_found')).not.toBeInTheDocument();
  });

  it('discards a response that a newer keystroke has already superseded', async () => {
    // Under a button this was a rare edge case; under type-ahead it is the normal one, because the
    // short query is slower to answer than the long query that replaced it.
    const slow = deferred<ProductSearchResponse>();
    const fast = deferred<ProductSearchResponse>();
    mockSearchProducts.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    render(<Harness />);
    openPicker();
    type('fri');
    await settle();
    type('fried');
    await settle();
    expect(mockSearchProducts).toHaveBeenCalledTimes(2);

    await act(async () => fast.resolve(ok([row('2', 'Fried Potatoes')])));
    expect(screen.getByText('Fried Potatoes')).toBeInTheDocument();

    await act(async () => slow.resolve(ok([row('1', 'Fricassee')])));
    expect(screen.getByText('Fried Potatoes')).toBeInTheDocument();
    expect(screen.queryByText('Fricassee')).not.toBeInTheDocument();
  });
});

describe('SuggestedSideItemsPicker — "no side items found" is an answer, not a default', () => {
  beforeEach(() => jest.useFakeTimers());

  it('does not claim an empty menu below the minimum length or while a request is in flight', async () => {
    const pending = deferred<ProductSearchResponse>();
    mockSearchProducts.mockReturnValue(pending.promise);

    render(<Harness />);
    openPicker();
    type('f');
    await settle();
    expect(screen.queryByText('no_side_items_found')).not.toBeInTheDocument();

    type('fries');
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('searching');
    expect(screen.queryByText('no_side_items_found')).not.toBeInTheDocument();
  });

  it('still reports genuinely empty results', async () => {
    mockSearchProducts.mockResolvedValue(ok([]));

    render(<Harness />);
    await search('fries');

    expect(screen.getByText('no_side_items_found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('SuggestedSideItemsPicker — a failed search must not answer "none found"', () => {
  beforeEach(() => jest.useFakeTimers());

  it('shows the server’s reason and suppresses the empty state', async () => {
    mockSearchProducts.mockRejectedValue(new ApiError(503, 'Menu service is unavailable'));

    render(<Harness />);
    await search('fries');

    expect(screen.getByRole('alert')).toHaveTextContent('Menu service is unavailable');
    expect(screen.queryByText('no_side_items_found')).not.toBeInTheDocument();
  });

  it('treats a 200-wrapped refusal as a failure and shows the reason from errors[]', async () => {
    // `searchProducts` returns the envelope rather than throwing, so without an explicit
    // `!resp.success` branch this read exactly like a product list with nothing in it.
    //
    // The fixture carries BOTH slots, which is the point: an earlier version supplied only
    // `message: 'Operation failed'`, so it passed whether the code read `errors[0]` or fell
    // straight to the client generic — it pinned nothing about which one wins.
    mockSearchProducts.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['Menu is being reindexed'],
    } as ProductSearchResponse);

    render(<Harness />);
    await search('fries');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Menu is being reindexed');
    expect(alert).not.toHaveTextContent('Operation failed');
  });

  it('falls back to the translated sentence when the refusal carries no reason', async () => {
    mockSearchProducts.mockResolvedValue({ success: false } as ProductSearchResponse);

    render(<Harness />);
    await search('fries');

    expect(screen.getByRole('alert')).toHaveTextContent('Could not search side items');
  });
});

describe('SuggestedSideItemsPicker — a failed details read must explain the id chips', () => {
  const detail = (id: string, name: string) => ({ success: true, data: { id, name, description: '' } });

  it('surfaces the failure rather than leaving bare ids on screen', async () => {
    mockGetProductById.mockRejectedValue(new ApiError(0, ''));

    render(<Harness selectedSideItemIds={['3f2a9c11-0000-0000-0000-000000000000']} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the selected side items');
    // The chip still falls back to the id — the point is that it is no longer unexplained.
    expect(screen.getByText(/Item 3f2a9c11/)).toBeInTheDocument();
  });

  it('fetches each selected id, so a menu larger than one page still names its chips', async () => {
    // The cliff this replaces: `getProducts(1, 100)` looked the ids up in the first page, so with
    // 101 products a selected side item outside it silently became an `Item 3f2a9c11…` chip.
    mockGetProductById.mockImplementation(async (id: string) => detail(id, id === 'abc' ? 'Fries' : 'Salad'));

    render(<Harness selectedSideItemIds={['abc', 'zzz']} />);

    expect(await screen.findByText('Fries')).toBeInTheDocument();
    expect(screen.getByText('Salad')).toBeInTheDocument();
    expect(mockGetProductById).toHaveBeenCalledWith('abc');
    expect(mockGetProductById).toHaveBeenCalledWith('zzz');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not refetch when only the language changes', async () => {
    // The regression this pins: listing `t` in the effect's deps instead of `useStableT`'s ref.
    // `t` is stable across ordinary re-renders, so it only shows up on a `languageChanged` — and
    // the language switcher sits in the shared admin chrome, above this screen.
    mockGetProductById.mockResolvedValue(detail('abc', 'Fries'));

    const { rerender } = render(<Harness selectedSideItemIds={['abc']} />);
    expect(await screen.findByText('Fries')).toBeInTheDocument();
    expect(mockGetProductById).toHaveBeenCalledTimes(1);

    mockCurrentT = mockTDe; // what `languageChanged` does to `t`'s identity
    rerender(<Harness selectedSideItemIds={['abc']} />);

    expect(await screen.findByText('Fries')).toBeInTheDocument();
    expect(mockGetProductById).toHaveBeenCalledTimes(1);
  });
});
