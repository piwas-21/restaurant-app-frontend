import { withGlobalIngredientProvenance, withoutTemporaryIds } from './globalIngredientReconciliation';
import { createGlobalIngredient, searchGlobalIngredients } from '@/services/globalIngredientService';
import type { ProductIngredient } from '@/types/menu';

jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(),
}));

const mockCreate = createGlobalIngredient as jest.MockedFunction<typeof createGlobalIngredient>;
const mockSearch = searchGlobalIngredients as jest.MockedFunction<typeof searchGlobalIngredients>;

const ingredient = (overrides: Partial<ProductIngredient> = {}): ProductIngredient => ({
  id: 'ing-1',
  name: 'Mozzarella',
  isOptional: false,
  price: 0,
  isActive: true,
  displayOrder: 0,
  ...overrides,
});

const found = (rows: { id: string; defaultName: string }[]) =>
  ({ success: true, data: rows.map((row) => ({ ...row, isActive: true, translations: [] })) }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch.mockResolvedValue(found([]));
  mockCreate.mockResolvedValue({ success: true, data: { id: 'created-1' } } as never);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the ingredient that could never be linked', () => {
  // THE defect. `createGlobalIngredient` used to run only `if (translations.length > 0)`, so an
  // ingredient typed without opening "Multilingual names" never got an id — and therefore ran a
  // fresh search on every single save, forever, for as long as the product existed.
  it('creates a library row for an ingredient with NO translations at all', async () => {
    const [result] = await withGlobalIngredientProvenance([ingredient({ content: undefined })]);

    expect(mockCreate).toHaveBeenCalledWith({ defaultName: 'Mozzarella', translations: [], kind: 'ingredient' });
    expect(result.globalIngredientId).toBe('created-1');
  });

  it('creates one for an ingredient whose translation slots are all blank', async () => {
    const blank = ingredient({ content: { en: { name: '' }, fr: { name: '   ' } } });

    const [result] = await withGlobalIngredientProvenance([blank]);

    expect(mockCreate).toHaveBeenCalledWith({ defaultName: 'Mozzarella', translations: [], kind: 'ingredient' });
    expect(result.globalIngredientId).toBe('created-1');
  });

  it('still sends the translations it does have', async () => {
    const translated = ingredient({ content: { en: { name: 'Mozzarella' }, fr: { name: 'Mozzarelle' } } });

    await withGlobalIngredientProvenance([translated]);

    expect(mockCreate).toHaveBeenCalledWith({
      defaultName: 'Mozzarella',
      translations: [
        { languageCode: 'en', name: 'Mozzarella' },
        { languageCode: 'fr', name: 'Mozzarelle' },
      ],
      kind: 'ingredient',
    });
  });
});

describe('what the reconciliation must NOT do', () => {
  // The picker's whole saving: a row picked from the library already knows where it came from, so
  // neither call should be made for it. This is also the regression that keeps provenance alive
  // across a save — nothing here may overwrite or drop an id the product already carries.
  it('leaves an ingredient that already carries provenance completely alone', async () => {
    const picked = ingredient({ globalIngredientId: 'global-7' });

    const [result] = await withGlobalIngredientProvenance([picked]);

    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.globalIngredientId).toBe('global-7');
  });

  it('adopts an existing library row instead of creating a duplicate', async () => {
    mockSearch.mockResolvedValue(found([{ id: 'global-9', defaultName: 'MOZZARELLA' }]));

    const [result] = await withGlobalIngredientProvenance([ingredient()]);

    expect(result.globalIngredientId).toBe('global-9');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('ignores a search hit that is a different ingredient', async () => {
    mockSearch.mockResolvedValue(found([{ id: 'global-9', defaultName: 'Mozzarella di Bufala' }]));

    const [result] = await withGlobalIngredientProvenance([ingredient()]);

    expect(mockCreate).toHaveBeenCalled();
    expect(result.globalIngredientId).toBe('created-1');
  });

  it('skips a nameless row rather than creating a nameless library entry', async () => {
    const [result] = await withGlobalIngredientProvenance([ingredient({ name: '   ' })]);

    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.globalIngredientId).toBeUndefined();
  });

  it('saves the ingredient anyway when the library refuses the write', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));

    const [result] = await withGlobalIngredientProvenance([ingredient()]);

    expect(result.name).toBe('Mozzarella');
    expect(result.globalIngredientId).toBeUndefined();
  });
});

describe('temporary ids', () => {
  // A `temp-` id must never reach the payload: the backend synchronizer reads a supplied id as
  // "update the row I already own" and skips one it does not recognise.
  it('drops a temp id and keeps a real one', () => {
    const result = withoutTemporaryIds([ingredient({ id: 'temp-123' }), ingredient({ id: 'real-1' })]);

    expect(result[0].id).toBeUndefined();
    expect(result[1].id).toBe('real-1');
  });

  it('keeps the provenance of the row whose id it strips', () => {
    const result = withoutTemporaryIds([ingredient({ id: 'temp-123', globalIngredientId: 'global-3' })]);

    expect(result[0].globalIngredientId).toBe('global-3');
  });
});

/**
 * Slice **G1** — the save-time half. `ProductIngredientsManager` stamps every row it creates with
 * the group it is, so a row's own `kind` IS the group the admin typed it into; this function has
 * only to send it.
 *
 * Measured before the fix: `GET /api/global-ingredients` on a live tenant answered 654 rows,
 * `ingredient` on 654 and `sauce` on 0 — because this call omitted `kind` and the backend defaults
 * an absent one to `ingredient`. The product row was right all along; the LIBRARY copy was not.
 */
describe('the kind a new library row is filed under (G1)', () => {
  it('files a row typed into the Sauces group AS A SAUCE', async () => {
    await withGlobalIngredientProvenance([ingredient({ name: 'Sauce samouraï', kind: 'sauce' })]);

    expect(mockCreate).toHaveBeenCalledWith({
      defaultName: 'Sauce samouraï',
      translations: [],
      kind: 'sauce',
    });
  });

  // The control: without it the case above also passes against a hardcoded `'sauce'`, which is the
  // shape of the defect being replaced with one constant swapped for another.
  it('files a row typed into the Ingredients group as an ingredient', async () => {
    await withGlobalIngredientProvenance([ingredient({ kind: 'ingredient' })]);

    expect(mockCreate.mock.calls[0][0].kind).toBe('ingredient');
  });

  /**
   * Every row on production predates the discriminator and carries no `kind` at all. It resolves to
   * `ingredient` here exactly as it does on every read — `undefined` must not reach the wire, where
   * it would be a third state the API has no meaning for.
   */
  it('resolves a row with no kind at all to an ingredient', async () => {
    await withGlobalIngredientProvenance([ingredient({ kind: undefined })]);

    expect(mockCreate.mock.calls[0][0].kind).toBe('ingredient');
  });

  /**
   * The honest limit, pinned so it cannot change by accident. The library is searched BY NAME only,
   * so a sauce whose name already exists as an ingredient ADOPTS that row: the product row stays a
   * sauce, the library row stays an ingredient, and nothing is created. Promoting it would let one
   * product's save rewrite a row every other product shares — the propagation plan D3 refuses.
   * Correcting a library row's kind is the library screen's job (G4).
   */
  it('adopts an existing row of the OTHER kind rather than rewriting a shared row', async () => {
    mockSearch.mockResolvedValue(found([{ id: 'global-9', defaultName: 'Harissa' }]));

    const [result] = await withGlobalIngredientProvenance([ingredient({ name: 'Harissa', kind: 'sauce' })]);

    expect(result.globalIngredientId).toBe('global-9');
    expect(result.kind).toBe('sauce');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
