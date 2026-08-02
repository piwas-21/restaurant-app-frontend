import { ApiError, apiClient } from '@/utils/apiClient';
import { OrderType } from '@/types/order';
import { getFeaturedSpecial, getProductById, getProducts } from './menuService';

/**
 * `getProducts` gained the customer's order type (S4). The server does NOT filter on it — it
 * resolves each row's `availability` — so the only thing worth pinning is that the parameter reaches
 * the query string under the name the backend binds (`GetProductsQuery.RequestedOrderType`), and
 * that omitting it leaves the request byte-identical for every admin/staff caller.
 */
const mockedGet = apiClient.get as jest.Mock;

function requestedUrl(): string {
  return mockedGet.mock.calls[0][0] as string;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('getProducts — RequestedOrderType', () => {
  it('sends the chosen channel under the name the backend binds', async () => {
    await getProducts(1, 10, null, undefined, OrderType.Takeaway);

    expect(requestedUrl()).toContain('RequestedOrderType=Takeaway');
  });

  it('sends nothing when no channel is chosen — the dominant browse state', async () => {
    await getProducts(1, 10, null, undefined, null);

    expect(requestedUrl()).not.toContain('RequestedOrderType');
  });

  it('leaves callers that never pass one untouched', async () => {
    await getProducts(2, 20, 'cat-1');

    expect(requestedUrl()).toBe('/api/Products?Page=2&PageSize=20&CategoryId=cat-1');
  });

  it('keeps the type filter working alongside the channel', async () => {
    await getProducts(1, 10, null, { type: 'Menu' }, OrderType.DineIn);

    expect(requestedUrl()).toBe('/api/Products?Page=1&PageSize=10&RequestedOrderType=DineIn&Type=Menu');
  });
});

/**
 * G7 — the banner is an entry point, so the same parameter has to reach the same binder here. Its
 * failure mode is the quiet one: without the channel the server resolves against "no channel
 * chosen", which is orderable BY DESIGN, so the hero would silently offer an item the catalog card
 * two rows below it refuses. Nothing errors; the guard is simply absent.
 */
describe('getFeaturedSpecial — RequestedOrderType', () => {
  it('sends the chosen channel', async () => {
    await getFeaturedSpecial(OrderType.DineIn);

    expect(requestedUrl()).toBe('/api/Products/featured-special?RequestedOrderType=DineIn');
  });

  it('sends nothing when no channel is chosen, leaving the request byte-identical to before G7', async () => {
    await getFeaturedSpecial(null);

    expect(requestedUrl()).toBe('/api/Products/featured-special');
  });

  it('leaves a caller that passes no argument untouched', async () => {
    await getFeaturedSpecial();

    expect(requestedUrl()).toBe('/api/Products/featured-special');
  });
});

/**
 * Both of these used to swallow the failure and return `mockApiClient`'s localStorage fixture —
 * ungated, so a live tenant's backend outage rendered invented dishes at invented prices under a
 * `success: true` envelope. The customer menu already had translated error copy it could never
 * reach. What is pinned here is the PROPAGATION: the caller must receive the server's own
 * `ApiError`, not a resolved value, because every consumer's error branch keys off the throw.
 */
describe('a failed fetch reaches the caller', () => {
  it('getProducts rejects with the ApiError rather than resolving to substitute data', async () => {
    mockedGet.mockRejectedValue(new ApiError(503, 'Service Unavailable'));

    await expect(getProducts(1, 10)).rejects.toThrow(ApiError);
  });

  it('getProducts preserves the server diagnosis, not a flattened message', async () => {
    mockedGet.mockRejectedValue(new ApiError(400, 'Bad Request', ['PageSize must be <= 100']));

    await expect(getProducts(1, 10_000)).rejects.toMatchObject({
      status: 400,
      errors: ['PageSize must be <= 100'],
    });
  });

  it('getProductById rejects rather than inventing a product', async () => {
    mockedGet.mockRejectedValue(new ApiError(404, 'Not Found'));

    await expect(getProductById('missing-id')).rejects.toMatchObject({ status: 404 });
  });
});

/**
 * `getFeaturedSpecial` keeps its swallow, and that is deliberate — the hero is decorative and a
 * missing one must never fail the home page. Pinned so the sweep above cannot be over-applied to
 * it by a later reader who sees three catches removed from this file and assumes the fourth was
 * an oversight.
 */
describe('getFeaturedSpecial — still absorbs its failure on purpose', () => {
  it('resolves to an empty special instead of throwing', async () => {
    mockedGet.mockRejectedValue(new ApiError(500, 'boom'));

    await expect(getFeaturedSpecial()).resolves.toMatchObject({ success: true, data: null });
  });
});
