import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GlobalIngredientPickerModal from './GlobalIngredientPickerModal';
import {
  createGlobalIngredient,
  getGlobalIngredients,
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
  createGlobalIngredient: jest.fn(),
}));

const mockGetLibrary = getGlobalIngredients as jest.MockedFunction<typeof getGlobalIngredients>;
const mockCreate = createGlobalIngredient as jest.MockedFunction<typeof createGlobalIngredient>;

const libraryRow = (
  id: string,
  defaultName: string,
  translations: { languageCode: string; name: string }[] = [],
): GlobalIngredientSummary => ({ id, defaultName, isActive: true, translations });

const CATALOG = [
  libraryRow('g-mozza', 'Mozzarella', [
    { languageCode: 'fr', name: 'Mozzarelle' },
    { languageCode: 'de', name: 'Mozzarella' },
  ]),
  libraryRow('g-basil', 'Basil', [{ languageCode: 'fr', name: 'Basilic' }]),
  // No translation at all — the row the `translated` filter must exclude.
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
});

const open = async (attached: ProductIngredient[] = []) => {
  render(<GlobalIngredientPickerModal isOpen onClose={onClose} attached={attached} onAdd={onAdd} />);
  await waitFor(() => expect(screen.getByLabelText('ingredient_library_search_label')).toBeInTheDocument());
  await act(async () => {});
};

const type = (term: string) =>
  fireEvent.change(screen.getByLabelText('ingredient_library_search_label'), { target: { value: term } });

const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));

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

    await waitFor(() => expect(screen.getByRole('button', { name: 'ingredient_library_retry' })).toBeInTheDocument());
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

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nope'));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
