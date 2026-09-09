import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import IngredientTranslationsPage from './page';
import { apiClient, ApiError } from '@/utils/apiClient';

/**
 * REAL-MOUNT integration test (the #750 gap): the grid suite rendered the table with props, so
 * the page's own wiring — guard, load effect, service calls — shipped untested, and the page
 * came up DEAD in production: the products LIST endpoint never carries `detailedIngredients`
 * (backend GetProductsQuery does not include them), the entries folded to nothing, and the page
 * rendered "No ingredients found." forever with nothing to search or save.
 *
 * This suite mounts the PAGE itself — real hook, real services, real guard logic, with only the
 * HTTP client (apiClient) and the two browser-only providers (router, auth) doubled — and the
 * apiClient.get mock is ROUTED BY URL, so it can hand the LIST the exact shape the backend ships
 * (empty `detailedIngredients` per row) while the DETAIL endpoint carries the real copies. The
 * first test is the regression pin for the shipped defect.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts && 'count' in opts ? `${key}:${opts.count}` : key),
  }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAdminUser = { firstName: 'A', lastName: 'D', email: 'a@b.c', role: 'Admin', accessToken: 'tok' };
jest.mock('@/components/AuthContext', () => ({
  useAuth: () => ({ user: mockAdminUser, isLoading: false, login: jest.fn(), logout: jest.fn() }),
}));

// Partial mock at the HTTP surface only: real ApiError (the service's 404-tolerant hydration
// does `instanceof ApiError`), stubbed verbs.
jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const copyOf = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name,
  isOptional: false,
  price: 0,
  isActive: true,
  displayOrder: 0,
  content: { en: { name } },
  ...overrides,
});

/** What the LIST endpoint really ships: rows with the ingredient field present but EMPTY. */
const LIST_PAGE = {
  success: true,
  message: '',
  data: {
    items: [
      { id: 'p1', name: 'Chicken Burger', detailedIngredients: [] },
      { id: 'p2', name: 'Tower Burger', detailedIngredients: [] },
    ],
    totalCount: 2,
    pageNumber: 1,
    totalPages: 1,
  },
};

/** What the DETAIL endpoint ships for the same products: the actual copies. */
const DETAILS: Record<string, unknown> = {
  p1: {
    success: true,
    data: {
      id: 'p1',
      name: 'Chicken Burger',
      detailedIngredients: [copyOf('i1', 'Lettuce', { globalIngredientId: 'g1' })],
    },
  },
  p2: {
    success: true,
    data: {
      id: 'p2',
      name: 'Tower Burger',
      detailedIngredients: [copyOf('i2', 'Sans Sauces', { kind: 'sauce', globalIngredientId: 'g2' })],
    },
  },
};

function routeGet(url: string) {
  if (url.includes('/api/Products?')) return Promise.resolve(LIST_PAGE);
  const id = url.split('/api/Products/')[1];
  if (id && id in DETAILS) return Promise.resolve(DETAILS[id]);
  return Promise.reject(new Error(`unexpected GET ${url}`));
}

/** A receipt the bulk-apply endpoint returns, sized by the test. */
const receiptFor = (count: number, names: string[]) => ({
  success: true,
  data: {
    updatedProductCount: count,
    updatedIngredientCount: count,
    items: names.map((productName, index) => ({
      productId: `p${index + 1}`,
      productName,
      ingredientId: `i${index + 1}`,
    })),
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.get as jest.Mock).mockImplementation(routeGet);
  (apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: null });
});

const enInputs = () => screen.getAllByLabelText('English · editor_translations_field_ingredient_name');

describe('IngredientTranslationsPage — the page mounts, hydrates the inventory and talks to the API', () => {
  it('pages the catalog AND hydrates each carrier from its detail endpoint, then renders the rows', async () => {
    render(<IngredientTranslationsPage />);

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/Products?Page=1&PageSize=100&IncludeMenus=true&IncludeComponents=true',
      ),
    );
    // The detail hydration is THE fix: the list rows carry no ingredient copies on the wire.
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/Products/p1'));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/Products/p2'));

    // The rows the copies produced are on screen, sauces and ingredients alike.
    expect(await screen.findByText('Lettuce')).toBeInTheDocument();
    expect(screen.getByText('Sans Sauces')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('search filters the hydrated entries client-side without refetching', async () => {
    render(<IngredientTranslationsPage />);
    await screen.findByText('Sans Sauces');
    fireEvent.change(screen.getByLabelText('ingredient_translations_search'), { target: { value: 'lettuce' } });

    await waitFor(() => expect(screen.queryByText('Sans Sauces')).not.toBeInTheDocument());
    expect(screen.getByText('Lettuce')).toBeInTheDocument();
    // Search is designed to filter what the mount already loaded — no extra request. The 3 is
    // also the mount's whole budget, pinned: 1 LIST + exactly one detail GET per carrier (a
    // cursor bug that double-fetched would show up here).
    expect((apiClient.get as jest.Mock).mock.calls).toHaveLength(3);
  });

  it('a carrier the detail endpoint refuses folds to carrying none, and the walk continues', async () => {
    // The REAL wire shape for a product deleted between the list and its detail call: HTTP 200
    // {success:false,data:null} — not a 404. It must read as carries-none, not kill the load.
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/Products?')) return Promise.resolve(LIST_PAGE);
      if (url.endsWith('/api/Products/p1')) return Promise.resolve(DETAILS.p1);
      if (url.endsWith('/api/Products/p2')) return Promise.resolve({ success: false, data: null });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    render(<IngredientTranslationsPage />);

    expect(await screen.findByText('Lettuce')).toBeInTheDocument();
    expect(screen.queryByText('Sans Sauces')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('a failed load shows the retryable error banner instead of a dead page', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<IngredientTranslationsPage />);

    expect(await screen.findByText('ingredient_translations_load_failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
  });

  it('a carrier deleted between list and detail (404) reads as carrying nothing — the rest still renders', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/Products/p1') {
        return Promise.reject(new ApiError(404, ''));
      }
      return routeGet(url);
    });
    render(<IngredientTranslationsPage />);

    // p2's sauce still lists; the vanished p1 copy did not kill the walk.
    expect(await screen.findByText('Sans Sauces')).toBeInTheDocument();
    expect(screen.queryByText('Lettuce')).not.toBeInTheDocument();
    expect(screen.queryByText('ingredient_translations_load_failed')).not.toBeInTheDocument();
  });
});

describe('IngredientTranslationsPage — the origin filter (partner feedback, trans-ux)', () => {
  const routeUnlinkedSauce = (url: string) => {
    if (url.includes('/api/Products?')) return Promise.resolve(LIST_PAGE);
    if (url.endsWith('/api/Products/p1')) return Promise.resolve(DETAILS.p1);
    if (url.endsWith('/api/Products/p2'))
      // No globalIngredientId: a legacy name-only copy — the tenant's own, not library-linked.
      return Promise.resolve({
        success: true,
        data: { id: 'p2', name: 'Tower Burger', detailedIngredients: [copyOf('i2', 'Sans Sauces', { kind: 'sauce' })] },
      });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  };

  it('splits the catalog into library-linked and tenant-custom rows, and back to all', async () => {
    (apiClient.get as jest.Mock).mockImplementation(routeUnlinkedSauce);
    render(<IngredientTranslationsPage />);
    await screen.findByText('Sans Sauces');
    expect(screen.getByText('Lettuce')).toBeInTheDocument();

    const originGroup = screen.getByRole('group', { name: 'ingredient_translations_filter_origin' });

    fireEvent.click(within(originGroup).getByRole('button', { name: 'ingredient_translations_origin_custom' }));
    expect(screen.getByText('Sans Sauces')).toBeInTheDocument();
    expect(screen.queryByText('Lettuce')).not.toBeInTheDocument();

    fireEvent.click(within(originGroup).getByRole('button', { name: 'ingredient_translations_origin_library' }));
    expect(screen.getByText('Lettuce')).toBeInTheDocument();
    expect(screen.queryByText('Sans Sauces')).not.toBeInTheDocument();

    fireEvent.click(within(originGroup).getByRole('button', { name: 'ingredient_translations_origin_all' }));
    expect(screen.getByText('Lettuce')).toBeInTheDocument();
    expect(screen.getByText('Sans Sauces')).toBeInTheDocument();
  });
});

describe('IngredientTranslationsPage — batch save from the sticky bar (partner feedback, trans-ux)', () => {
  it('an edited row raises the sticky bar; save-all applies it; the untouched row is never sent', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue(receiptFor(2, ['Chicken Burger', 'Tower Burger']));
    render(<IngredientTranslationsPage />);
    await screen.findByText('Lettuce');

    // No edits, no bar.
    expect(screen.queryByRole('button', { name: 'ingredient_translations_save_all' })).not.toBeInTheDocument();

    // Rows sort sauces first, so row 0 is the 'Sans Sauces' sauce (library row g2).
    fireEvent.change(enInputs()[0], { target: { value: 'No sauce, please' } });

    // The bar names ONE dirty row — Lettuce was never touched, and must never be marked dirty.
    expect(screen.getByText('ingredient_translations_unsaved:1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ingredient_translations_save_all' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    const [url, body] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/global-ingredients/g2/apply-translations');
    // The body IS the bare list of { languageCode, name } (backend PR #511 contract).
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual(
      expect.arrayContaining([expect.objectContaining({ languageCode: 'en', name: 'No sauce, please' })]),
    );

    expect(await screen.findByText(/ingredient_translations_receipt_products:2/)).toBeInTheDocument();
    expect(screen.getByText(/Chicken Burger/)).toBeInTheDocument();
    // The batch committed: the bar is gone.
    await waitFor(() => expect(screen.queryByText('ingredient_translations_unsaved:1')).not.toBeInTheDocument());
  });

  it('two edited rows go out as TWO bulk-applies in one press, then the bar clears', async () => {
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce(receiptFor(2, ['Chicken Burger', 'Tower Burger']))
      .mockResolvedValueOnce(receiptFor(1, ['Chicken Burger']));
    render(<IngredientTranslationsPage />);
    await screen.findByText('Lettuce');

    fireEvent.change(enInputs()[0], { target: { value: 'No sauce, please' } });
    fireEvent.change(enInputs()[1], { target: { value: 'Cos' } });
    expect(screen.getByText('ingredient_translations_unsaved:2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ingredient_translations_save_all' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    // Sauce-first order: Sans Sauces (g2), then Lettuce (g1) — each gets its own apply.
    expect((apiClient.post as jest.Mock).mock.calls[0][0]).toBe('/api/global-ingredients/g2/apply-translations');
    expect((apiClient.post as jest.Mock).mock.calls[1][0]).toBe('/api/global-ingredients/g1/apply-translations');
    expect((apiClient.post as jest.Mock).mock.calls[1][1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ languageCode: 'en', name: 'Cos' })]),
    );
    // The receipt aggregates BOTH applies.
    expect(await screen.findByText(/ingredient_translations_receipt_products:3/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('ingredient_translations_unsaved:2')).not.toBeInTheDocument());
  });

  it('an edit reverted to the shown value is not dirty — the bar never appears', async () => {
    render(<IngredientTranslationsPage />);
    await screen.findByText('Sans Sauces');

    // The en cell SHOWS the copy's own name 'Sans Sauces'; typing it back is not an edit.
    fireEvent.change(enInputs()[0], { target: { value: 'X' } });
    expect(screen.getByText('ingredient_translations_unsaved:1')).toBeInTheDocument();
    fireEvent.change(enInputs()[0], { target: { value: 'Sans Sauces' } });
    expect(screen.queryByText('ingredient_translations_unsaved:1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ingredient_translations_save_all' })).not.toBeInTheDocument();
  });

  it('a mid-batch refusal keeps the failed row dirty, saves the rest, and shows the error banner', async () => {
    (apiClient.post as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/g2/')) return Promise.resolve(receiptFor(2, ['Chicken Burger', 'Tower Burger']));
      return Promise.resolve({ success: false, data: null });
    });
    render(<IngredientTranslationsPage />);
    await screen.findByText('Lettuce');

    fireEvent.change(enInputs()[0], { target: { value: 'No sauce, please' } });
    fireEvent.change(enInputs()[1], { target: { value: 'Cos' } });
    fireEvent.click(screen.getByRole('button', { name: 'ingredient_translations_save_all' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    // The landed half shows its receipt; the refused half keeps its edits.
    expect(await screen.findByText(/ingredient_translations_receipt_products:2/)).toBeInTheDocument();
    expect(screen.getByText('ingredient_translations_save_failed')).toBeInTheDocument();
    expect(screen.getByText('ingredient_translations_unsaved:1')).toBeInTheDocument();
  });
});

describe('IngredientTranslationsPage — client-side pagination (partner feedback, trans-ux)', () => {
  /** 26 tenants-carried entries: one page of 25, plus one row on page 2. */
  const makeCatalog = () => {
    const items = Array.from({ length: 26 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Product ${index + 1}`,
      detailedIngredients: [],
    }));
    const details: Record<string, unknown> = {};
    items.forEach((item, index) => {
      const n = index + 1;
      details[item.id] = {
        success: true,
        data: {
          id: item.id,
          name: item.name,
          detailedIngredients: [
            copyOf(`i${n}`, `Ingredient ${String(n).padStart(2, '0')}`, { globalIngredientId: `g${n}` }),
          ],
        },
      };
    });
    return {
      list: { success: true, message: '', data: { items, totalCount: 26, pageNumber: 1, totalPages: 1 } },
      details,
    };
  };

  it('slices the loaded catalog, pages through it, and resets the page when the size changes', async () => {
    const catalog = makeCatalog();
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/Products?')) return Promise.resolve(catalog.list);
      const id = url.split('/api/Products/')[1];
      return Promise.resolve(catalog.details[id]);
    });

    render(<IngredientTranslationsPage />);
    await screen.findByText('Ingredient 01');

    // Default page size 25: the first page only, with the showing caption.
    expect(enInputs()).toHaveLength(25);
    expect(screen.getByText('showing_items')).toBeInTheDocument();
    expect(screen.queryByText('Ingredient 26')).not.toBeInTheDocument();

    // Next page: the 26th row.
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Ingredient 26')).toBeInTheDocument();
    expect(screen.queryByText('Ingredient 01')).not.toBeInTheDocument();

    // A bigger page size resets to page 1 and shows the whole catalog — still no refetch.
    fireEvent.change(screen.getByLabelText('ingredient_translations_per_page'), { target: { value: '100' } });
    expect(await screen.findByText('Ingredient 01')).toBeInTheDocument();
    expect(enInputs()).toHaveLength(26);
    expect(
      (apiClient.get as jest.Mock).mock.calls.filter(([url]) => String(url).includes('/api/Products?')),
    ).toHaveLength(1);
  });

  it('a search narrow enough for one page hides the pager controls entirely', async () => {
    const catalog = makeCatalog();
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/Products?')) return Promise.resolve(catalog.list);
      const id = url.split('/api/Products/')[1];
      return Promise.resolve(catalog.details[id]);
    });

    render(<IngredientTranslationsPage />);
    await screen.findByText('Ingredient 01');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('ingredient_translations_search'), { target: { value: 'ingredient 26' } });
    expect(await screen.findByText('Ingredient 26')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
    // The page-size selector stays — it is a preference, not a pager state.
    expect(screen.getByLabelText('ingredient_translations_per_page')).toBeInTheDocument();
  });
});
