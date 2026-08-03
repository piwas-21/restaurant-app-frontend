import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { SuggestedSideItemsPicker } from './SuggestedSideItemsPicker';
import { getProducts } from '@/services/menuService';
import { ApiError } from '@/utils/apiClient';

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

jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));

const mockGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentT = mockTEn;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
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

const ok = (items: unknown[]) =>
  ({
    success: true,
    message: '',
    data: { items, totalCount: items.length, page: 1, pageSize: 20, totalPages: 1 },
  }) as unknown as Awaited<ReturnType<typeof getProducts>>;

const search = async (term: string) => {
  // These call sites pass no `t()` fallback, so the mock yields the raw key as the label.
  fireEvent.click(screen.getByRole('button', { name: 'add_side_items' }));
  fireEvent.change(screen.getByPlaceholderText('search_placeholder'), { target: { value: term } });
  fireEvent.click(screen.getByRole('button', { name: 'search' }));
};

describe('SuggestedSideItemsPicker — a failed search must not answer "none found"', () => {
  it('shows the server’s reason and suppresses the empty state', async () => {
    mockGetProducts.mockRejectedValue(new ApiError(503, 'Menu service is unavailable'));

    render(<Harness />);
    await search('fries');

    expect(await screen.findByRole('alert')).toHaveTextContent('Menu service is unavailable');
    expect(screen.queryByText('no_side_items_found')).not.toBeInTheDocument();
  });

  it('treats a 200-wrapped refusal as a failure and shows the reason from errors[]', async () => {
    // `getProducts` returns the envelope rather than throwing, so without an explicit
    // `!resp.success` branch this read exactly like a product list with nothing in it.
    //
    // The fixture carries BOTH slots, which is the point: an earlier version supplied only
    // `message: 'Operation failed'`, so it passed whether the code read `errors[0]` or fell
    // straight to the client generic — it pinned nothing about which one wins.
    mockGetProducts.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['Menu is being reindexed'],
    } as unknown as Awaited<ReturnType<typeof getProducts>>);

    render(<Harness />);
    await search('fries');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Menu is being reindexed');
    expect(alert).not.toHaveTextContent('Operation failed');
  });

  it('falls back to the translated sentence when the refusal carries no reason', async () => {
    mockGetProducts.mockResolvedValue({ success: false } as unknown as Awaited<ReturnType<typeof getProducts>>);

    render(<Harness />);
    await search('fries');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not search side items');
  });

  it('still reports genuinely empty results', async () => {
    mockGetProducts.mockResolvedValue(ok([]));

    render(<Harness />);
    await search('fries');

    expect(await screen.findByText('no_side_items_found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('SuggestedSideItemsPicker — a failed details read must explain the id chips', () => {
  it('surfaces the failure rather than leaving bare ids on screen', async () => {
    mockGetProducts.mockRejectedValue(new ApiError(0, ''));

    render(<Harness selectedSideItemIds={['3f2a9c11-0000-0000-0000-000000000000']} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the selected side items');
    // The chip still falls back to the id — the point is that it is no longer unexplained.
    expect(screen.getByText(/Item 3f2a9c11/)).toBeInTheDocument();
  });

  it('does not refetch when only the language changes', async () => {
    // The regression this pins: listing `t` in the effect's deps instead of `useStableT`'s ref.
    // `t` is stable across ordinary re-renders, so it only shows up on a `languageChanged` — and
    // the language switcher sits in the shared admin chrome, above this screen.
    mockGetProducts.mockResolvedValue(
      ok([{ id: 'abc', name: 'Fries', description: '', basePrice: 4, type: 'mainItem' }]),
    );

    const { rerender } = render(<Harness selectedSideItemIds={['abc']} />);
    expect(await screen.findByText('Fries')).toBeInTheDocument();
    expect(mockGetProducts).toHaveBeenCalledTimes(1);

    mockCurrentT = mockTDe; // what `languageChanged` does to `t`'s identity
    rerender(<Harness selectedSideItemIds={['abc']} />);

    expect(await screen.findByText('Fries')).toBeInTheDocument();
    expect(mockGetProducts).toHaveBeenCalledTimes(1);
  });

  it('shows no error once the names resolve', async () => {
    mockGetProducts.mockResolvedValue(
      ok([{ id: 'abc', name: 'Fries', description: '', basePrice: 4, type: 'mainItem' }]),
    );

    render(<Harness selectedSideItemIds={['abc']} />);

    expect(await screen.findByText('Fries')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
