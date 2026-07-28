import { apiClient } from '@/utils/apiClient';
import { OrderType } from '@/types/order';
import { getPublicMenuBundles } from './menuBundleService';

/**
 * `getPublicMenuBundles` gained the guest's order type (§9.2). As with `getProducts`, the server
 * does NOT filter on it — it resolves each row's `availability` — so what is worth pinning is that
 * the parameter reaches the query string under the name the backend binds, and that omitting it
 * leaves the request byte-identical for every caller that has none.
 */
const mockedGet = apiClient.get as jest.Mock;

function requestedUrl(): string {
  return mockedGet.mock.calls[0][0] as string;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('getPublicMenuBundles — RequestedOrderType', () => {
  it('sends the chosen channel under the name the backend binds', async () => {
    await getPublicMenuBundles(1, 10, OrderType.Takeaway);

    expect(requestedUrl()).toContain('RequestedOrderType=Takeaway');
  });

  it('sends nothing when no channel is chosen — the dominant browse state', async () => {
    await getPublicMenuBundles(1, 10, null);

    expect(requestedUrl()).toBe('/api/Menus?page=1&pageSize=10');
  });

  it('leaves a caller that never passes one untouched', async () => {
    await getPublicMenuBundles(2, 20);

    expect(requestedUrl()).toBe('/api/Menus?page=2&pageSize=20');
  });
});
