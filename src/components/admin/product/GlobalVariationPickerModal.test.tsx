import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GlobalVariationPickerModal from './GlobalVariationPickerModal';
import {
  archiveGlobalVariation,
  createGlobalVariation,
  getArchivedGlobalVariations,
  getGlobalVariations,
  restoreGlobalVariation,
  type GlobalVariationSummary,
} from '@/services/globalVariationService';

// `t` returns the KEY, and never the second argument: every call site here passes an interpolation
// OBJECT there, and a mock that echoed it would render `[object Object]` into the DOM instead of a
// label — which is a mock disagreeing with react-i18next, not a test.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr-CH' } }),
}));

jest.mock('@/services/globalVariationService', () => ({
  getGlobalVariations: jest.fn(),
  getArchivedGlobalVariations: jest.fn(),
  createGlobalVariation: jest.fn(),
  archiveGlobalVariation: jest.fn(),
  restoreGlobalVariation: jest.fn(),
}));

const mockGetLibrary = getGlobalVariations as jest.MockedFunction<typeof getGlobalVariations>;
const mockGetArchived = getArchivedGlobalVariations as jest.MockedFunction<typeof getArchivedGlobalVariations>;
const mockCreate = createGlobalVariation as jest.MockedFunction<typeof createGlobalVariation>;
const mockArchive = archiveGlobalVariation as jest.MockedFunction<typeof archiveGlobalVariation>;
const mockRestore = restoreGlobalVariation as jest.MockedFunction<typeof restoreGlobalVariation>;

/**
 * `origin` defaults to `'custom'` here, and that is a fixture DECISION rather than a shortcut: every
 * case in this file that predates the origin discriminator is about the destructive action, and a
 * built-in is never offered one (backend D14). A default of `'system'` would silently retarget all
 * of them at a row that has no button to press. The built-in rule gets its own row below.
 */
const libraryRow = (
  id: string,
  defaultName: string,
  translations: { languageCode: string; name: string }[] = [],
  usedOnProductCount = 0,
  isArchived = false,
  origin: 'system' | 'custom' = 'custom',
): GlobalVariationSummary => ({
  id,
  defaultName,
  isActive: true,
  translations,
  usedOnProductCount,
  isArchived,
  origin,
});

const CATALOG = [
  libraryRow(
    'g-large',
    'Large',
    [
      { languageCode: 'fr', name: 'Grande' },
      { languageCode: 'de', name: 'Groß' },
    ],
    41,
  ),
  libraryRow('g-small', 'Small', [{ languageCode: 'fr', name: 'Portion réduite' }], 1),
  // No translation at all — the row the `translated` filter must exclude. Nothing uses it either,
  // which is what makes its destructive action say Delete rather than Archive.
  libraryRow('g-magnum', 'Magnum'),
  // A platform-seeded row that nothing uses — the case the picker used to label "Delete" on all
  // fifty shipped rows, and the one the server now refuses whatever the client offers.
  libraryRow('g-seeded', 'Seeded Size', [], 0, false, 'system'),
];

const onAdd = jest.fn();
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLibrary.mockResolvedValue({ success: true, data: CATALOG } as never);
  mockGetArchived.mockResolvedValue({ success: true, data: [] } as never);
});

/**
 * Render the picker and wait for the CATALOG, not for the search box — the box is painted while
 * the fetch is still in flight, so waiting on it resolves before the list exists (the failure
 * frontend #569 measured under `--ci --coverage`, where instrumentation costs one extra tick).
 */
const open = async (
  attached: { name: string; globalVariationId?: string }[] = [],
  nextDisplayOrder = attached.length,
) => {
  render(
    <GlobalVariationPickerModal
      isOpen
      onClose={onClose}
      attached={attached}
      nextDisplayOrder={nextDisplayOrder}
      onAdd={onAdd}
    />,
  );
  await screen.findByRole('list');
};

const type = (term: string) =>
  fireEvent.change(screen.getByLabelText('variation_library_search_label'), { target: { value: term } });

const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));

/** The `<li>` a name is on, so two rows' identical action labels and figures stay distinguishable. */
const rowFor = (name: string) => {
  const row = screen.getByText(name).closest('li');
  if (!row) throw new Error(`no library row for ${name}`);
  return within(row);
};

describe('browsing the variation library (plan S4)', () => {
  // The catalog has no `/search` endpoint by decision (backend #431); the whole list is read once
  // and filtered here. One call per open is the contract that makes that affordable.
  it('reads the whole catalog once and never calls a search endpoint', async () => {
    await open();

    expect(mockGetLibrary).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(CATALOG.length);
  });

  it('matches a TRANSLATED name, which is the reason it does not ask the server', async () => {
    await open();

    type('grande');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  /**
   * A LIMIT, stated because it is easy to assume otherwise: the fold strips combining marks, so
   * `é` matches `e` — but German `ß` is a letter, not an accented `s`, and NFD leaves it alone.
   * "gros" therefore does NOT find "Groß". That is the shipped ingredient behaviour this picker
   * shares, and widening it is a change to both catalogs, not a variation-picker decision.
   */
  it('folds accents, so "reduite" finds "réduite"', async () => {
    await open();

    type('reduite');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByText('Small')).toBeInTheDocument();
  });

  it('hides a row the UI language has no name for behind the translated filter', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'variation_library_filter_translated' }));
    await waitFor(() => expect(screen.queryByText('Magnum')).toBeNull());
    // `fr-CH` must resolve through its primary subtag, or every row would be filtered out.
    expect(screen.getByText('Large')).toBeInTheDocument();
  });
});

describe('what picking a row hands back', () => {
  /**
   * THE assertion of this file. The catalog carries no price (backend #431) because "Large" is
   * +2.00 on a pizza and +0.50 on a coffee, so a picked row must land NEUTRAL — not at a number the
   * library guessed. A modifier the picker invented would misprice the item on its very first save.
   */
  it('hands back a neutral price modifier and the translations, never a price', async () => {
    await open();

    tick('Large');
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [picked] = onAdd.mock.calls[0] as [{ priceModifier: number; content: Record<string, { name: string }> }[]];
    expect(picked[0].priceModifier).toBe(0);
    expect(picked[0].content.fr.name).toBe('Grande');
    expect(picked[0].content.de.name).toBe('Groß');
  });

  it('records provenance, which is what makes the row findable as already added later', async () => {
    await open();

    tick('Small');
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    const [picked] = onAdd.mock.calls[0] as [{ globalVariationId?: string; name: string }[]];
    expect(picked[0]).toMatchObject({ globalVariationId: 'g-small', name: 'Small' });
  });

  /**
   * The display order CONTINUES the product's list rather than restarting at 0, and the base is one
   * PAST the highest order in use — not the row count. `useVariationReorder` (#593) states that
   * live `displayOrder` data holds gaps and duplicates, so a count-based base would collide.
   */
  it('continues the display order from the rows the product already has', async () => {
    await open([{ name: 'Regular' }], 3);

    tick('Large');
    tick('Small');
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    const [picked] = onAdd.mock.calls[0] as [{ displayOrder: number }[]];
    expect(picked.map((row) => row.displayOrder)).toEqual([3, 4]);
  });

  it('closes and forgets its selection, so the next open does not re-add anything', async () => {
    await open();

    tick('Large');
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('a row the product already has', () => {
  // Review gap G23, shipped for ingredients in frontend #597. Unticked-and-disabled reads "not
  // selected", which is the OPPOSITE of what is true, and left the italic caption to overturn the
  // tick box next to it.
  it('is drawn TICKED and disabled, not unticked', async () => {
    await open([{ name: 'Small' }]);

    const box = rowFor('Small').getByRole('checkbox', { name: 'Small' });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    // A row the product does NOT have is still offered unticked, so the tick means one thing only.
    expect(rowFor('Large').getByRole('checkbox', { name: 'Large' })).not.toBeChecked();
  });

  // The tick is presentational; it must not become a selection, or Add would count rows the product
  // already has and the PUT would carry duplicates.
  it('does not count as selected', async () => {
    await open([{ name: 'Small' }]);

    expect(screen.getByRole('button', { name: /add_selected/ })).toBeDisabled();
  });

  it('is recognised by provenance even after the admin renamed it on the product', async () => {
    // Every variation on prod predates the library and carries only a name, which is why the name
    // key exists at all — but once a row IS linked, a rename must not offer it back as new.
    await open([{ name: 'Family size', globalVariationId: 'g-large' }]);

    expect(rowFor('Large').getByRole('checkbox', { name: 'Large' })).toBeChecked();
  });

  it('shows "already added" in the usage cell instead of the figure', async () => {
    await open([{ name: 'Small' }]);

    expect(rowFor('Small').getByText('already_added')).toBeInTheDocument();
    expect(rowFor('Small').queryByLabelText('variation_library_used_on')).toBeNull();
  });
});

describe('creating the row the catalog does not have', () => {
  it('creates it from the search term and attaches it in the same click', async () => {
    mockCreate.mockResolvedValue({ success: true, data: libraryRow('g-new', 'Sharing platter') } as never);
    await open();

    type('Sharing platter');
    fireEvent.click(screen.getByRole('button', { name: /variation_library_create/ }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith({ defaultName: 'Sharing platter', translations: [] });
    const [picked] = onAdd.mock.calls[0] as [{ name: string; globalVariationId?: string }[]];
    expect(picked[0]).toMatchObject({ name: 'Sharing platter', globalVariationId: 'g-new' });
  });

  it('reports a refusal and adds nothing', async () => {
    mockCreate.mockResolvedValue({ success: false, errors: ['nope'] } as never);
    await open();

    type('Sharing platter');
    fireEvent.click(screen.getByRole('button', { name: /variation_library_create/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('what a row costs to change, and retiring it (plan D4)', () => {
  it('renders the usage count off the DTO — many, one and none', async () => {
    await open();

    expect(rowFor('Large').getByLabelText('variation_library_used_on')).toHaveTextContent('41');
    expect(rowFor('Small').getByLabelText('variation_library_used_on')).toHaveTextContent('1');
    expect(rowFor('Magnum').getByLabelText('variation_library_used_on')).toHaveTextContent('0');
  });

  // The label must be what the server will DO: `DELETE` archives a row in use and soft-deletes one
  // that is not, branching on this very count.
  it('offers Archive for a row in use and Delete for one nothing uses', async () => {
    await open();

    expect(rowFor('Large').getByRole('button', { name: 'variation_library_archive' })).toBeInTheDocument();
    expect(rowFor('Magnum').getByRole('button', { name: 'variation_library_delete' })).toBeInTheDocument();
  });

  it('stops offering a row the moment it is retired, without waiting for the refetch', async () => {
    mockArchive.mockResolvedValue({ success: true } as never);
    await open();

    fireEvent.click(rowFor('Large').getByRole('button', { name: 'variation_library_archive' }));
    fireEvent.click(rowFor('Large').getByRole('button', { name: 'confirm' }));

    await waitFor(() => expect(screen.queryByText('Large')).toBeNull());
    expect(mockArchive).toHaveBeenCalledWith('g-large');
  });

  it('keeps the row on screen when the write fails, rather than hiding one that is still there', async () => {
    mockArchive.mockResolvedValue({ success: false, errors: ['in use'] } as never);
    await open();

    fireEvent.click(rowFor('Large').getByRole('button', { name: 'variation_library_archive' }));
    fireEvent.click(rowFor('Large').getByRole('button', { name: 'confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('in use');
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('restores from the archive drawer, and reads that list only when it is opened', async () => {
    mockGetArchived.mockResolvedValue({
      success: true,
      data: [libraryRow('g-old', 'Half portion', [], 0, true)],
    } as never);
    mockRestore.mockResolvedValue({ success: true } as never);
    await open();

    expect(mockGetArchived).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'variation_library_view_archived' }));

    await screen.findByText('Half portion');
    fireEvent.click(screen.getByRole('button', { name: 'variation_library_restore' }));
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('g-old'));
  });

  // Nothing in the archive can be attached, so offering a tick box there would promise something
  // the view cannot do.
  it('offers nothing to tick in the archive drawer', async () => {
    mockGetArchived.mockResolvedValue({
      success: true,
      data: [libraryRow('g-old', 'Half portion', [], 0, true)],
    } as never);
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'variation_library_view_archived' }));

    await screen.findByText('Half portion');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('when the catalog cannot be read', () => {
  it('says so and offers a retry that asks again', async () => {
    mockGetLibrary.mockResolvedValue({ success: false, errors: ['down'] } as never);
    render(<GlobalVariationPickerModal isOpen onClose={onClose} attached={[]} nextDisplayOrder={0} onAdd={onAdd} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('down');
    fireEvent.click(screen.getByRole('button', { name: 'variation_library_retry' }));
    await waitFor(() => expect(mockGetLibrary).toHaveBeenCalledTimes(2));
  });
});

/**
 * Backend D14. These catalogs are per-tenant TABLES seeded with platform rows, so a name we shipped
 * and a name the admin typed were the same shape in the same table — and the picker offered
 * "Delete" on all fifty.
 */
describe('the tenant’s own shelf', () => {
  it('offers no destructive action on a built-in, even one nothing uses', async () => {
    await open();

    const seeded = rowFor('Seeded Size');
    // OMITTED, not disabled: a disabled control here would suggest the row could be removed by some
    // other means. Its usage count is 0, which is exactly the case that used to say "Delete".
    expect(seeded.queryByRole('button', { name: 'variation_library_delete' })).not.toBeInTheDocument();
    expect(seeded.queryByRole('button', { name: 'variation_library_archive' })).not.toBeInTheDocument();
  });

  it('still offers one on the tenant’s own row, in the same list', async () => {
    await open();

    expect(rowFor('Magnum').getByRole('button', { name: 'variation_library_delete' })).toBeInTheDocument();
  });

  it('narrows to the tenant’s own rows on the third shelf, from the list already in memory', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'variation_library_view_mine' }));

    expect(screen.getByText('Magnum')).toBeInTheDocument();
    expect(screen.queryByText('Seeded Size')).not.toBeInTheDocument();
    // One fetch for the whole modal — the shelf is a narrowing, not a second endpoint.
    expect(mockGetLibrary).toHaveBeenCalledTimes(1);
  });

  it('keeps the search box and the chips on that shelf, unlike the archive drawer', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'variation_library_view_mine' }));

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'variation_library_filter_not_added' })).toBeInTheDocument();
  });
});

/**
 * The reported defect. "+ Create new" creates from the SEARCH TERM, so with an empty box there was
 * nothing to create — and the button was enabled, labelled, and inert. An admin pressed it and the
 * modal did nothing at all.
 */
describe('“+ Create new” with an empty search box', () => {
  it('says what it needs and puts the caret there, instead of doing nothing', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: /variation_library_create/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('variation_library_create_needs_name');
    expect(screen.getByLabelText('variation_library_search_label')).toHaveFocus();
    // The point of the complaint: nothing was written.
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('retires the complaint as soon as something is typed', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /variation_library_create/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    type('Sharing platter');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /** …and with a term, it still creates, which is the behaviour that already worked. */
  it('still creates from a typed term', async () => {
    await open();
    type('Sharing platter');

    fireEvent.click(screen.getByRole('button', { name: /variation_library_create/ }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ defaultName: 'Sharing platter', translations: [] }));
  });
});
