import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { SuggestedSideItemsPicker } from './SuggestedSideItemsPicker';
import { getProductById } from '@/services/menuService';
import { ApiError } from '@/utils/apiClient';

/**
 * The `Options & sides` SECTION: the chips that say what a dish suggests today, and the way in to
 * the picker (plan S9 / D12).
 *
 * What used to be here and is not any more: the search, the result rows and every state they can be
 * in. They moved with the inline expander into `SideItemPickerModal.test.tsx`, ported rather than
 * rewritten. What stays is what the section still owns — the chips, the failed detail read that
 * explains them, and the fact that the picker is a `BaseModal` that opens and closes.
 *
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

jest.mock('@/services/productService', () => ({
  searchProducts: jest.fn(async () => ({ success: true, data: { items: [] } })),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

const mockGetProductById = getProductById as jest.MockedFunction<typeof getProductById>;

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentT = mockTEn;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** `<Controller>` needs a real `control`, so the picker is mounted inside a throwaway form. */
function Harness({
  selectedSideItemIds = [] as string[],
  onChange = () => {},
}: {
  selectedSideItemIds?: string[];
  onChange?: (ids: string[]) => void;
}) {
  const { control, formState } = useForm({ defaultValues: { suggestedSideItemIds: '' } });
  // `SuggestedSideItemsPickerProps` types both `errors` and `control` as `any` (pre-existing debt
  // in `product/types.ts`), so no cast is needed here.
  return (
    <SuggestedSideItemsPicker
      errors={formState.errors}
      control={control}
      selectedSideItemIds={selectedSideItemIds}
      onChange={onChange}
      productId="the-dish-being-edited"
    />
  );
}

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: 'side_items_picker_open' }));

describe('SuggestedSideItemsPicker — the way in to the picker', () => {
  it('opens the picker as a BaseModal dialog, and closes it again', async () => {
    // `BaseModal` is the house rule for every overlay (CLAUDE.md §5 rule 2); the expander this
    // replaces was a bare `<div>` in the page, with no dialog role, no ESC and no backdrop.
    mockGetProductById.mockResolvedValue({ success: true, data: { id: 'abc', name: 'Fries' } });
    render(<Harness selectedSideItemIds={['abc']} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openPicker();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the button for BOTH directions, because the picker now does both', () => {
    render(<Harness />);

    expect(screen.getByRole('button', { name: 'side_items_picker_open' })).toBeInTheDocument();
    // The shipped `add_side_items` key is deliberately no longer this button's label: it named a
    // surface that could only add.
    expect(screen.queryByRole('button', { name: 'add_side_items' })).not.toBeInTheDocument();
  });

  it('writes the picker’s answer straight through, unmerged', async () => {
    mockGetProductById.mockResolvedValue({ success: true, data: { id: 'abc', name: 'Fries' } });
    const onChange = jest.fn();
    render(<Harness selectedSideItemIds={['abc']} onChange={onChange} />);

    openPicker();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Fries' }));
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('keeps the chip’s own remove, which is the one-click path for the common case', async () => {
    mockGetProductById.mockImplementation(async (id: string) => ({
      success: true,
      data: { id, name: id === 'abc' ? 'Fries' : 'Salad' },
    }));
    const onChange = jest.fn();
    render(<Harness selectedSideItemIds={['abc', 'zzz']} onChange={onChange} />);

    expect(await screen.findByText('Fries')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);

    expect(onChange).toHaveBeenCalledWith(['zzz']);
  });

  it('says so when nothing is suggested', () => {
    render(<Harness />);
    expect(screen.getByText('no_side_items_selected')).toBeInTheDocument();
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
