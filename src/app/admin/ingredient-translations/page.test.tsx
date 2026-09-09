import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.get as jest.Mock).mockImplementation(routeGet);
  (apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: null });
});

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
    const callsAfterLoad = (apiClient.get as jest.Mock).mock.calls.length;

    fireEvent.change(screen.getByLabelText('ingredient_translations_search'), { target: { value: 'lettuce' } });

    await waitFor(() => expect(screen.queryByText('Sans Sauces')).not.toBeInTheDocument());
    expect(screen.getByText('Lettuce')).toBeInTheDocument();
    // Search is designed to filter what the mount already loaded — no extra request.
    expect((apiClient.get as jest.Mock).mock.calls.length).toBe(callsAfterLoad);
  });

  it('save posts the bare translation list to apply-translations and shows the receipt', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        updatedProductCount: 2,
        updatedIngredientCount: 2,
        items: [
          { productId: 'p1', productName: 'Chicken Burger', ingredientId: 'i1' },
          { productId: 'p2', productName: 'Tower Burger', ingredientId: 'i2' },
        ],
      },
    });
    render(<IngredientTranslationsPage />);
    await screen.findByText('Lettuce');

    // Rows sort sauces first, so row 0 is the 'Sans Sauces' sauce (library row g2).
    const enInputs = screen.getAllByLabelText('English · editor_translations_field_ingredient_name');
    fireEvent.change(enInputs[0], { target: { value: 'No sauce, please' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'save' })[0]);

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const [url, body] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/global-ingredients/g2/apply-translations');
    // The body IS the bare list of { languageCode, name } (backend PR #511 contract).
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual(
      expect.arrayContaining([expect.objectContaining({ languageCode: 'en', name: 'No sauce, please' })]),
    );

    expect(await screen.findByText(/ingredient_translations_receipt_products:2/)).toBeInTheDocument();
    expect(screen.getByText(/Chicken Burger/)).toBeInTheDocument();
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
