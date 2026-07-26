import { apiClient } from '@/utils/apiClient';
import { OrderType } from '@/types/order';
import { getProducts } from './menuService';

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
