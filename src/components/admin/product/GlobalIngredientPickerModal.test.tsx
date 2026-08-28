import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GlobalIngredientPickerModal from './GlobalIngredientPickerModal';
import {
  archiveGlobalIngredient,
  createGlobalIngredient,
  getArchivedGlobalIngredients,
  getGlobalIngredients,
  restoreGlobalIngredient,
  type GlobalIngredientSummary,
} from '@/services/globalIngredientService';
import type { ProductIngredient } from '@/types/menu';

// `t` returns the KEY, and never the second argument: every call site here passes an interpolation
// OBJECT there, and a mock that echoed it would render `[object Object]` into the DOM instead of a
// label — which is a mock disagreeing with react-i18next, not a test.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr-CH' } }),
}));

jest.mock('@/services/globalIngredientService', () => ({
  getGlobalIngredients: jest.fn(),
  getArchivedGlobalIngredients: jest.fn(),
  createGlobalIngredient: jest.fn(),
  archiveGlobalIngredient: jest.fn(),
  restoreGlobalIngredient: jest.fn(),
}));

const mockGetLibrary = getGlobalIngredients as jest.MockedFunction<typeof getGlobalIngredients>;
const mockGetArchived = getArchivedGlobalIngredients as jest.MockedFunction<typeof getArchivedGlobalIngredients>;
const mockCreate = createGlobalIngredient as jest.MockedFunction<typeof createGlobalIngredient>;
const mockArchive = archiveGlobalIngredient as jest.MockedFunction<typeof archiveGlobalIngredient>;
const mockRestore = restoreGlobalIngredient as jest.MockedFunction<typeof restoreGlobalIngredient>;

const libraryRow = (
  id: string,
  defaultName: string,
  translations: { languageCode: string; name: string }[] = [],
  usedOnProductCount = 0,
  isArchived = false,
): GlobalIngredientSummary => ({
  id,
  defaultName,
  isActive: true,
  translations,
  usedOnProductCount,
  isArchived,
});

const CATALOG = [
  libraryRow(
    'g-mozza',
    'Mozzarella',
    [
      { languageCode: 'fr', name: 'Mozzarelle' },
      { languageCode: 'de', name: 'Mozzarella' },
    ],
    41,
  ),
  libraryRow('g-basil', 'Basil', [{ languageCode: 'fr', name: 'Basilic' }], 1),
  // No translation at all — the row the `translated` filter must exclude. Nothing uses it either,
  // which is what makes its destructive action say Delete rather than Archive.
  libraryRow('g-caper', 'Câpres'),
];

const attachedIngredient = (overrides: Partial<ProductIngredient> = {}): ProductIngredient => ({
  id: 'ing-1',
  name: 'Olives',
  isOptional: false,
  price: 0,
  isActive: true,
  displayOrder: 0,
  ...overrides,
});

const onAdd = jest.fn();
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLibrary.mockResolvedValue({ success: true, data: CATALOG } as never);
  mockGetArchived.mockResolvedValue({ success: true, data: [] } as never);
});

/**
 * Render the picker and wait for the CATALOG, not for the search box.
 *
 * The search box is painted while the fetch is still in flight, so waiting on it resolves before
 * the list exists — which passed locally and failed under `--ci --coverage`, where the extra
 * instrumentation cost one more tick than a bare `await act()` flushed. Waiting for the `list`
 * role is a wait for the state the assertions are actually about. Every caller here seeds a
 * non-empty catalog; the empty and error paths render themselves and do not use this helper.
 */
const open = async (attached: ProductIngredient[] = []) => {
  render(<GlobalIngredientPickerModal isOpen onClose={onClose} attached={attached} onAdd={onAdd} />);
  await screen.findByRole('list');
};

const type = (term: string) =>
  fireEvent.change(screen.getByLabelText('ingredient_library_search_label'), { target: { value: term } });

const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));

/** The `<li>` a name is on, so two rows' identical action labels and figures stay distinguishable. */
const rowFor = (name: string) => {
  const row = screen.getByText(name).closest('li');
  if (!row) throw new Error(`no library row for ${name}`);
  return within(row);
};

const showArchived = () => fireEvent.click(screen.getByRole('button', { name: 'ingredient_library_view_archived' }));
const showLibrary = () => fireEvent.click(screen.getByRole('button', { name: 'ingredient_library_view_active' }));

describe('browsing the library', () => {
  // The complaint this slice answers: the catalog has been seeded with 654 entries since the
  // GlobalIngredients migration and nothing ever LISTED it — the only way in was a type-ahead that
  // needs you to guess the name first.
  it('lists the whole library with an empty search box', async () => {
    await open();

    expect(mockGetLibrary).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Basil/ })).toBeInTheDocument();
  });

  it('does not fetch the catalog while it is closed', () => {
    render(<GlobalIngredientPickerModal isOpen={false} onClose={onClose} attached={[]} onAdd={onAdd} />);

    expect(mockGetLibrary).not.toHaveBeenCalled();
  });

  it('filters by name as the admin types', async () => {
    await open();

    type('basi');

    expect(screen.getByRole('checkbox', { name: /Basil/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Mozzarella/ })).not.toBeInTheDocument();
  });

  // The server endpoint matches `DefaultName` only, so a French admin typing the French word gets
  // nothing out of it. Filtering the browsed list covers the translations too.
  it('finds a row by a TRANSLATED name, which the search endpoint cannot do', async () => {
    await open();

    type('mozzarelle');

    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeInTheDocument();
  });

  it('ignores accents, so "capres" finds "Câpres"', async () => {
    await open();

    type('capres');

    expect(screen.getByRole('checkbox', { name: /Câpres/ })).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    await open();

    type('zzzz');

    expect(screen.getByText('ingredient_library_empty')).toBeInTheDocument();
  });

  it('offers a retry when the catalog cannot be read', async () => {
    mockGetLibrary.mockRejectedValue(new Error('offline'));

    render(<GlobalIngredientPickerModal isOpen onClose={onClose} attached={[]} onAdd={onAdd} />);

    expect(await screen.findByRole('button', { name: 'ingredient_library_retry' })).toBeInTheDocument();
  });
});

describe('an ingredient the product already has', () => {
  // Matched by provenance AND by name: every ingredient on prod predates this slice and carries no
  // `globalIngredientId` at all, so an id-only test would offer the whole existing recipe back.
  it('is not offerable again when it carries the library id', async () => {
    await open([attachedIngredient({ name: 'Anything', globalIngredientId: 'g-mozza' })]);

    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeDisabled();
  });

  it('is not offerable again when it only matches by name', async () => {
    await open([attachedIngredient({ name: 'mozzarella' })]);

    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeDisabled();
  });

  it('can be hidden entirely with the "not on this item" filter', async () => {
    await open([attachedIngredient({ name: 'Basil' })]);

    fireEvent.click(screen.getByRole('button', { name: 'ingredient_library_filter_not_added' }));

    expect(screen.queryByRole('checkbox', { name: /Basil/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeInTheDocument();
  });

  it('keeps only rows translated into the admin\'s language under the "translated" filter', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'ingredient_library_filter_translated' }));

    // `fr-CH` is normalised to its primary subtag, the way every other resolver in the app does it.
    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Câpres/ })).not.toBeInTheDocument();
  });
});

describe('picking rows', () => {
  it('adds nothing until something is ticked', async () => {
    await open();

    expect(screen.getByRole('button', { name: /add_selected/ })).toBeDisabled();
  });

  it('hands back every ticked row, mapped onto the product', async () => {
    await open([attachedIngredient()]);

    tick('Mozzarella');
    tick('Basil');
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const added = onAdd.mock.calls[0][0] as ProductIngredient[];
    expect(added.map((row) => row.name)).toEqual(['Mozzarella', 'Basil']);
    expect(added.map((row) => row.globalIngredientId)).toEqual(['g-mozza', 'g-basil']);
    // Appended after the ingredient the product already had, not renumbered from zero.
    expect(added.map((row) => row.displayOrder)).toEqual([1, 2]);
    // The 10 free-text translation inputs this slice exists to save.
    expect(added[0].content?.fr?.name).toBe('Mozzarelle');
    expect(added[0].content?.de?.name).toBe('Mozzarella');
    // Ten locale slots, not the seven `handleAddIngredient` hardcodes.
    expect(Object.keys(added[0].content ?? {})).toHaveLength(10);
    // The server has never seen this row, so its id must not look like one it issued.
    expect(added[0].id.startsWith('temp-')).toBe(true);
  });

  it('un-ticking a row takes it back out of the selection', async () => {
    await open();

    tick('Mozzarella');
    tick('Basil');
    tick('Mozzarella');
    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    expect((onAdd.mock.calls[0][0] as ProductIngredient[]).map((row) => row.name)).toEqual(['Basil']);
  });

  it('closes and forgets the selection', async () => {
    await open();

    tick('Mozzarella');
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('creating a row the library does not have', () => {
  // The other half of the never-linked defect: a brand-new ingredient has no translations yet, and
  // it must still come back with an id — otherwise it is re-searched on every save, forever.
  it('creates it with an EMPTY translation list and attaches the id it gets back', async () => {
    mockCreate.mockResolvedValue({ success: true, data: libraryRow('g-new', 'Truffle Oil') } as never);
    await open();

    type('Truffle Oil');
    fireEvent.click(screen.getByRole('button', { name: /ingredient_library_create/ }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith({ defaultName: 'Truffle Oil', translations: [] });
    const added = onAdd.mock.calls[0][0] as ProductIngredient[];
    expect(added).toHaveLength(1);
    expect(added[0].globalIngredientId).toBe('g-new');
    expect(added[0].name).toBe('Truffle Oil');
  });

  it('creates it alongside whatever is already ticked', async () => {
    mockCreate.mockResolvedValue({ success: true, data: libraryRow('g-new', 'Truffle Oil') } as never);
    await open();

    tick('Basil');
    type('Truffle Oil');
    fireEvent.click(screen.getByRole('button', { name: /ingredient_library_create/ }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect((onAdd.mock.calls[0][0] as ProductIngredient[]).map((row) => row.name)).toEqual(['Basil', 'Truffle Oil']);
  });

  it('does nothing at all with an empty search box', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: /ingredient_library_create/ }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('reports a refusal and adds nothing', async () => {
    mockCreate.mockResolvedValue({ success: false, errors: ['nope'] } as never);
    await open();

    type('Truffle Oil');
    fireEvent.click(screen.getByRole('button', { name: /ingredient_library_create/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('what a row costs to change (plan S3)', () => {
  // The count is the whole point of the reverse link: it is the number of products that would be
  // affected by an edit, and it is what the backend branches on when the row is retired.
  it('renders the usage count off the DTO — many, one and none', async () => {
    await open();

    expect(rowFor('Mozzarella').getByLabelText('ingredient_library_used_on')).toHaveTextContent('41');
    expect(rowFor('Basil').getByLabelText('ingredient_library_used_on')).toHaveTextContent('1');
    expect(rowFor('Câpres').getByLabelText('ingredient_library_used_on')).toHaveTextContent('0');
  });

  // The approved screen puts "already added" in the USAGE cell, in place of the figure.
  it('replaces the figure with "already added" on a row the product already has', async () => {
    await open([attachedIngredient({ name: 'Basil' })]);

    expect(rowFor('Basil').getByText('already_added')).toBeInTheDocument();
    expect(rowFor('Basil').queryByLabelText('ingredient_library_used_on')).toBeNull();
  });
});

describe('retiring a library row (plan D4)', () => {
  // The label must be what the server will DO: `DELETE` archives a row in use and soft-deletes one
  // that is not, branching on this very count.
  it('offers Archive for a row in use and Delete for one nothing uses', async () => {
    await open();

    expect(rowFor('Mozzarella').getByRole('button', { name: 'ingredient_library_archive' })).toBeInTheDocument();
    expect(rowFor('Câpres').getByRole('button', { name: 'ingredient_library_delete' })).toBeInTheDocument();
    expect(rowFor('Câpres').queryByRole('button', { name: 'ingredient_library_archive' })).toBeNull();
  });

  it('asks first, inside the row, and writes nothing when the admin backs out', async () => {
    await open();

    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'ingredient_library_archive' }));
    expect(rowFor('Mozzarella').getByText('ingredient_library_archive_confirm')).toBeInTheDocument();
    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'cancel' }));

    expect(mockArchive).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeInTheDocument();
  });

  it('reports a refusal and leaves the row exactly where it was', async () => {
    mockArchive.mockResolvedValue({ success: false, errors: ['still referenced'] } as never);
    await open();

    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'ingredient_library_archive' }));
    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('still referenced');
    expect(screen.getByRole('checkbox', { name: /Mozzarella/ })).toBeInTheDocument();
  });
});

describe('the archived view', () => {
  it('says so when nothing has been archived', async () => {
    await open();

    showArchived();

    expect(await screen.findByText('ingredient_library_archived_empty')).toBeInTheDocument();
  });

  // The list endpoint promises to exclude archived rows. The picker must not depend on that
  // promise: an archived row can never be attached, so it is neither listed nor findable.
  it('never offers an archived row, even when the list endpoint returns one', async () => {
    mockGetLibrary.mockResolvedValue({
      success: true,
      data: [...CATALOG, libraryRow('g-old', 'Fondue', [{ languageCode: 'fr', name: 'Fondue' }], 3, true)],
    } as never);
    await open();

    expect(screen.queryByRole('checkbox', { name: /Fondue/ })).not.toBeInTheDocument();

    type('fondue');

    expect(screen.getByText('ingredient_library_empty')).toBeInTheDocument();
  });

  /**
   * A stateful pair of endpoints, because the behaviour under test is that the row LEAVES one list
   * and JOINS the other — a fixed mock can show neither half of that.
   */
  const withMovingRows = () => {
    let active = [...CATALOG];
    let archived: GlobalIngredientSummary[] = [];
    mockGetLibrary.mockImplementation(async () => ({ success: true, data: active }) as never);
    mockGetArchived.mockImplementation(async () => ({ success: true, data: archived }) as never);
    mockArchive.mockImplementation(async (id: string) => {
      const moved = active.filter((entry) => entry.id === id).map((entry) => ({ ...entry, isArchived: true }));
      active = active.filter((entry) => entry.id !== id);
      archived = [...archived, ...moved];
      return { success: true, data: 'archived' } as never;
    });
    mockRestore.mockImplementation(async (id: string) => {
      const moved = archived.filter((entry) => entry.id === id).map((entry) => ({ ...entry, isArchived: false }));
      archived = archived.filter((entry) => entry.id !== id);
      active = [...active, ...moved];
      return { success: true, data: moved[0] } as never;
    });
  };

  it('moves a row out of the library and into the archive, and back again on restore', async () => {
    withMovingRows();
    await open();

    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'ingredient_library_archive' }));
    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'confirm' }));

    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith('g-mozza'));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: /Mozzarella/ })).not.toBeInTheDocument());

    showArchived();

    expect(await screen.findByText('Mozzarella')).toBeInTheDocument();
    // Archived rows are never selectable — there is no tick box at all, not a disabled one.
    expect(screen.queryByRole('checkbox', { name: /Mozzarella/ })).not.toBeInTheDocument();

    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'ingredient_library_restore' }));

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('g-mozza'));
    expect(await screen.findByText('ingredient_library_archived_empty')).toBeInTheDocument();

    showLibrary();

    expect(await screen.findByRole('checkbox', { name: /Mozzarella/ })).toBeInTheDocument();
  });

  it('takes an archived row out of the pending selection', async () => {
    withMovingRows();
    await open();

    tick('Mozzarella');
    tick('Basil');
    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'ingredient_library_archive' }));
    fireEvent.click(rowFor('Mozzarella').getByRole('button', { name: 'confirm' }));
    // Wait for the catalog REFETCH the archive triggers, not just for the write: leaving it in
    // flight lands a `setState` after the test has finished, which is what React reports as an
    // update outside `act()`.
    await waitFor(() => expect(mockGetLibrary).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: /add_selected/ }));

    expect((onAdd.mock.calls[0][0] as ProductIngredient[]).map((row) => row.name)).toEqual(['Basil']);
  });
});
