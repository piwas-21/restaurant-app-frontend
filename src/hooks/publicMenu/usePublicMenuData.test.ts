/**
 * The public menu's failure surface.
 *
 * `error` here is consumed as a FLAG — `MenuContent` renders its own translated sentence off
 * `errorLoadingItems ? t(…) : null` — so an empty string is not a weaker message, it is NO message,
 * and the same failure path also clears the item list. The two together turn a dead backend into
 * "No items in category" on the most-visited page in the app.
 *
 * That was latent for as long as `apiClient` manufactured an English sentence for every failure.
 * #401 stopped it, so these pin the property directly: whatever comes out of a failed fetch, the
 * caller gets something truthy.
 */

import { act, renderHook } from '@testing-library/react';
import { usePublicMenuData } from './usePublicMenuData';
import { getProducts } from '@/services/menuService';
import { getPublicMenuBundles } from '@/services/menuBundleService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({ getPublicMenuBundles: jest.fn() }));

const mockGetProducts = getProducts as jest.Mock;
const mockGetBundles = getPublicMenuBundles as jest.Mock;

/** Minimal wire shapes — only what the mappers and `isVisible` read. */
function productDto(name: string) {
  return { id: `p-${name}`, name, basePrice: 4, isActive: true, isAvailable: true };
}
function bundleDto(name: string) {
  return {
    id: `b-${name}`,
    name,
    basePrice: 12,
    isActive: true,
    isAvailable: true,
    menuDefinition: { sections: [] },
    categoryIds: ['cat-viande'],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Every shape a failed fetch can arrive in, including the ones `apiClient` emits after #401. */
const FAILURES: Array<[string, unknown]> = [
  ['a dead backend — status 0, nothing to say', new ApiError(0, '')],
  ['an HTML 502 — status 500, nothing to say', new ApiError(500, '')],
  ['a whitespace-only server message', new ApiError(400, '   ')],
  ['a resolved-failure object with a blank message', { message: '' }],
  ['a resolved-failure object with a whitespace message', { message: '   ' }],
  ['a plain Error with no message', new Error('')],
  ['a non-object throw', 'boom'],
];

describe('fetchProducts always reports something the caller can show', () => {
  it.each(FAILURES)('falls back for %s', async (_label, thrown) => {
    mockGetProducts.mockRejectedValueOnce(thrown);
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, null);
    });

    expect(result.current.error).toBe('Failed to fetch products');
  });

  it("prefers the SERVER's sentence when there is one", async () => {
    mockGetProducts.mockRejectedValueOnce(new ApiError(400, 'This category is not available for delivery'));
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, null);
    });

    expect(result.current.error).toBe('This category is not available for delivery');
  });

  // The trim matters because `'   '` must become ABSENCE — see the table above. Padding around a
  // real sentence is normalised for the same reason and has no visible effect today, since
  // `MenuContent` renders its own translated string off this value's truthiness rather than the
  // value itself.
  it('normalises padding around a server sentence', async () => {
    mockGetProducts.mockRejectedValueOnce({ message: '  Menu is being updated  ' });
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, null);
    });

    expect(result.current.error).toBe('Menu is being updated');
  });
});

/**
 * The other half of the same `setError`. `apiClient` THROWS on a non-2xx, so a resolved
 * `{ success: false }` is the shape that arrives when a handler failed inside a 200 — and the
 * header's promise ("whatever comes out of a failed fetch") is only true if it covers this too.
 */
describe('a RESOLVED failure reports something the caller can show', () => {
  it.each([
    ['no message at all', { success: false }],
    ['a blank message', { success: false, message: '' }],
    ['a whitespace-only message', { success: false, message: '   ' }],
  ])('falls back for %s', async (_label, response) => {
    mockGetProducts.mockResolvedValueOnce(response);
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, null);
    });

    expect(result.current.error).toBe('Failed to fetch products');
  });

  it("shows the server's own reason when the payload carries one", async () => {
    mockGetProducts.mockResolvedValueOnce({ success: false, message: 'Menu is being updated' });
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, null);
    });

    expect(result.current.error).toBe('Menu is being updated');
  });

  it('falls back for a resolved bundle failure with a whitespace message', async () => {
    mockGetBundles.mockResolvedValueOnce({ success: false, message: '   ' });
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchMenuBundles(1);
    });

    expect(result.current.bundlesError).toBe('Failed to fetch menu bundles');
    // A bundles failure must not blank the products grid with its error.
    expect(result.current.error).toBeNull();
  });
});

describe('fetchMenuBundles always reports something the caller can show', () => {
  it.each(FAILURES)('falls back for %s', async (_label, thrown) => {
    mockGetBundles.mockRejectedValueOnce(thrown);
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchMenuBundles(1);
    });

    expect(result.current.bundlesError).toBe('Failed to fetch menu bundles');
  });
});

/**
 * The two pipelines run CONCURRENTLY now — bundles load on every view because they are grouped
 * into the category tabs — so the old shared request-id counter is a correctness bug, not a
 * perf detail: whichever fetch started second marked the first one stale, and its response was
 * discarded on arrival. The two fetchers own disjoint state, so each answer is stale only
 * against its own successor.
 */
describe('the two pipelines can be in flight at the same time', () => {
  it('commits a bundles response that lands after a products fetch started', async () => {
    let resolveBundles: (value: unknown) => void = () => {};
    mockGetBundles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBundles = resolve;
        }),
    );
    mockGetProducts.mockResolvedValueOnce({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });

    const { result } = renderHook(() => usePublicMenuData());

    let bundlesFetch: Promise<void>;
    act(() => {
      bundlesFetch = result.current.fetchMenuBundles(1);
    });
    await act(async () => {
      await result.current.fetchProducts(1, null);
    });
    await act(async () => {
      resolveBundles({
        success: true,
        data: { items: [bundleDto('LIBANAISE 1 VIANDE')], totalPages: 1, totalCount: 1 },
      });
      await bundlesFetch;
    });

    expect(result.current.menuBundles).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.bundlesError).toBeNull();
  });

  it('commits a products response that lands after a bundles fetch started', async () => {
    let resolveProducts: (value: unknown) => void = () => {};
    mockGetProducts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProducts = resolve;
        }),
    );
    mockGetBundles.mockResolvedValueOnce({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });

    const { result } = renderHook(() => usePublicMenuData());

    let productsFetch: Promise<void>;
    act(() => {
      productsFetch = result.current.fetchProducts(1, null);
    });
    await act(async () => {
      await result.current.fetchMenuBundles(1);
    });
    await act(async () => {
      resolveProducts({ success: true, data: { items: [productDto('Plat du jour')], totalPages: 1, totalCount: 1 } });
      await productsFetch;
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });
});

/** The public menu sends this on every fetch — see usePublicMenuData. */
describe('fetchProducts declares the guest all-view', () => {
  it('sends the opt-in the backend reads as GuestAllView', async () => {
    mockGetProducts.mockResolvedValueOnce({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, null);
    });

    expect(mockGetProducts.mock.calls[0][5]).toBe(true);
  });
});

/**
 * The GUEST menu and the option-only opt-in (frontend #631).
 *
 * `GET /api/Products` excludes `isComponent` rows unless the caller asks for them, so the guest
 * menu is protected by a DEFAULT — by the absence of a parameter. An absence is exactly the kind of
 * thing that gets added by accident when a sibling caller needs it, and nothing on this screen would
 * look wrong afterwards: the six meats of "Tacos Double Viandes" would simply appear as six
 * orderable dishes at their component prices.
 *
 * The fourth argument is the product-type query, which is where `includeComponents` lives.
 */
describe('the guest menu never asks for option-only items', () => {
  it('passes no product-type query at all on a plain browse', async () => {
    mockGetProducts.mockResolvedValueOnce({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, null);
    });

    expect(mockGetProducts).toHaveBeenCalledTimes(1);
    expect(mockGetProducts.mock.calls[0][3]).toBeUndefined();
  });

  it('still asks for nothing when a category is chosen', async () => {
    mockGetProducts.mockResolvedValueOnce({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });
    const { result } = renderHook(() => usePublicMenuData());

    await act(async () => {
      await result.current.fetchProducts(1, 'cat-1');
    });

    expect(mockGetProducts.mock.calls[0][3]).toBeUndefined();
  });
});
