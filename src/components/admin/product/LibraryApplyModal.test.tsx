import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LibraryApplyModal from './LibraryApplyModal';
import { INGREDIENT_LIBRARY_COPY } from './libraryPickerCopy';
import { getProducts } from '@/services/menuService';

/**
 * The apply step end to end, at the level the admin meets it (plan S8, decision D6).
 *
 * `libraryApplyTargets.test.ts` owns the arithmetic with hand-computed oracles; this file owns the
 * two claims that only the assembled screen can make: what the CONFIRM BUTTON says before it is
 * pressed, and which product ids the request actually carries. The second is the one that matters —
 * a screen that counts 2 and posts 3 is a lie about a catalog-wide write, and no unit test of either
 * half can catch it.
 */

// `t` returns the KEY, and appends a `count` when one is interpolated, so a number the screen
// renders is visible to an assertion. Without that, "Apply to 2 items" and "Apply to 3 items" are
// the SAME STRING in this suite and the confirm sentence cannot be tested at all.
//
// The second argument is not always an options object — `BaseModal` calls `t('close', 'Close')`
// with an inline default — so the type is narrowed before `in` is used on it. A mock that assumed
// the object form threw on render, which is a mock disagreeing with react-i18next, not a defect.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) =>
      typeof options === 'object' && options !== null && 'count' in options
        ? `${key}:${String((options as { count: unknown }).count)}`
        : key,
    i18n: { language: 'fr-CH' },
  }),
}));

jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));

const mockGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;

/**
 * Two categories, and MARGHERITA IS IN BOTH — the shape that makes counting ticks wrong. Quattro
 * already carries the row, so the fixture can also tell "selected" from "will change".
 */
const PRODUCTS = [
  {
    id: 'margherita',
    name: 'Margherita',
    categories: [
      { categoryId: 'pizzas', categoryName: 'Pizzas' },
      { categoryId: 'lunch', categoryName: 'Lunch' },
    ],
  },
  { id: 'quattro', name: 'Quattro', categories: [{ categoryId: 'pizzas', categoryName: 'Pizzas' }] },
  { id: 'diavola', name: 'Diavola', categories: [{ categoryId: 'pizzas', categoryName: 'Pizzas' }] },
];

const renderModal = (attach: jest.Mock, usageIds: string[] = ['quattro']) => {
  const fetchUsage = jest.fn().mockResolvedValue({
    success: true,
    data: usageIds.map((id) => ({ productId: id, productName: id, isActive: true })),
  });

  render(
    <LibraryApplyModal
      isOpen
      row={{ id: 'chilli-oil', defaultName: 'Chilli oil' }}
      copy={INGREDIENT_LIBRARY_COPY}
      endpoints={{ fetchUsage, attach }}
      onBack={jest.fn()}
      onClose={jest.fn()}
      onAttached={jest.fn()}
    />,
  );

  return { fetchUsage };
};

const confirmButton = () => screen.getByRole('button', { name: /ingredient_library_apply_confirm/ });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue({
    success: true,
    message: '',
    errors: null,
    data: { items: PRODUCTS, totalCount: 3, page: 1, pageSize: 500, totalPages: 1 },
  } as unknown as Awaited<ReturnType<typeof getProducts>>);
});

describe('LibraryApplyModal — the blast-radius confirm (D6)', () => {
  it('starts at zero and refuses to apply, because nothing is selected yet', async () => {
    renderModal(jest.fn());

    await screen.findByText('ingredient_library_apply_lead');
    expect(confirmButton()).toHaveTextContent('ingredient_library_apply_confirm:0');
    expect(confirmButton()).toBeDisabled();
  });

  it('draws a product that already carries the row as ticked and disabled, not unticked', async () => {
    renderModal(jest.fn());

    const quattro = await screen.findByRole('checkbox', { name: 'Quattro' });
    expect(quattro).toBeChecked();
    expect(quattro).toBeDisabled();
  });

  it('counts DISTINCT products when a category select-all catches one listed twice', async () => {
    renderModal(jest.fn());

    // "Pizzas" holds Margherita, Quattro and Diavola. Quattro already has the row, so selecting the
    // whole category is TWO changes — and Margherita is also listed under Lunch, so a screen that
    // counted ticks would say three.
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Pizzas' }));

    await waitFor(() => expect(confirmButton()).toHaveTextContent('ingredient_library_apply_confirm:2'));
    expect(screen.getByText('ingredient_library_apply_already_have:1')).toBeInTheDocument();
  });

  it('shows the category header as mixed once one of its products is picked', async () => {
    renderModal(jest.fn());

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Diavola' }));

    const pizzas = screen.getByRole('checkbox', { name: 'Pizzas' }) as HTMLInputElement;
    await waitFor(() => expect(pizzas).toHaveAttribute('aria-checked', 'mixed'));
    // The DASH as well as the announcement: `aria-checked` is an attribute and `indeterminate` is a
    // DOM property with no attribute at all, so asserting only the first leaves the box rendering
    // as an ordinary empty checkbox. Measured — that mutant survived a suite that checked only ARIA.
    expect(pizzas.indeterminate).toBe(true);
    // The control: the same header is NOT mixed once every actionable product is picked.
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Margherita' })[0]);
    await waitFor(() => expect(pizzas).not.toHaveAttribute('aria-checked', 'mixed'));
  });

  it('POSTS exactly the ids the confirm counted — never the already-attached one', async () => {
    const attach = jest
      .fn()
      .mockResolvedValue({ success: true, data: { attachedProductIds: ['margherita', 'diavola'], skipped: [] } });
    renderModal(attach);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Pizzas' }));
    await waitFor(() => expect(confirmButton()).toHaveTextContent('ingredient_library_apply_confirm:2'));
    fireEvent.click(confirmButton());

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    // The oracle is the count the BUTTON showed, checked against the payload — two instruments that
    // could disagree, which is the whole point of asserting them together.
    expect(attach).toHaveBeenCalledWith('chilli-oil', ['margherita', 'diavola']);
  });

  it('reports what it did, and says how many were stepped over', async () => {
    const attach = jest.fn().mockResolvedValue({
      success: true,
      data: {
        attachedProductIds: ['margherita', 'diavola'],
        skipped: [{ productId: 'quattro', productName: 'Quattro', reason: 'alreadyLinked' }],
      },
    });
    renderModal(attach);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Pizzas' }));
    await waitFor(() => expect(confirmButton()).toHaveTextContent('ingredient_library_apply_confirm:2'));
    fireEvent.click(confirmButton());

    expect(await screen.findByText('ingredient_library_apply_done:2')).toBeInTheDocument();
    expect(screen.getByText('ingredient_library_apply_skipped:1')).toBeInTheDocument();
  });

  it('shows the server message and writes nothing more when the batch is refused', async () => {
    const attach = jest.fn().mockResolvedValue({
      success: false,
      errors: ['Nothing was attached. On Thin Margin the optional ingredients …'],
    });
    renderModal(attach);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Pizzas' }));
    await waitFor(() => expect(confirmButton()).toHaveTextContent('ingredient_library_apply_confirm:2'));
    fireEvent.click(confirmButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Thin Margin/)).toBeInTheDocument();
    // Still on the selection screen, not on a receipt: an all-or-nothing refusal must not look
    // like a partial success.
    expect(screen.queryByText(/ingredient_library_apply_done/)).not.toBeInTheDocument();
  });

  it('groups a product no category claims rather than dropping it from the screen', async () => {
    mockGetProducts.mockResolvedValue({
      success: true,
      message: '',
      errors: null,
      data: { items: [{ id: 'water', name: 'Still water' }], totalCount: 1, page: 1, pageSize: 500, totalPages: 1 },
    } as unknown as Awaited<ReturnType<typeof getProducts>>);
    renderModal(jest.fn(), []);

    expect(await screen.findByRole('checkbox', { name: 'Still water' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ingredient_library_apply_uncategorised' })).toBeInTheDocument();
  });
});
