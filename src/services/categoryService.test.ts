import { ApiError, apiClient } from '@/utils/apiClient';
import { getCategories } from './categoryService';

/**
 * `getCategories` used to answer a failed fetch with `mockApiClient`'s localStorage fixture — six
 * invented categories under a `success: true` envelope, with no environment gate, so a live
 * tenant's backend outage produced a browsable menu of dishes that do not exist.
 *
 * Two things are pinned: the request shape the backend binds (PascalCase paging, easy to break
 * silently because the server defaults rather than rejects), and that a failure now REACHES the
 * caller. Every consumer already had an error branch — the customer menu even has translated copy
 * for it in `MenuContent` — those branches were simply unreachable.
 */
const mockedGet = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('getCategories — request', () => {
  it('sends the paging parameters under the PascalCase names the backend binds', async () => {
    await getCategories(2, 50);

    expect(mockedGet).toHaveBeenCalledWith('/api/Categories?PageNumber=2&PageSize=50');
  });

  it('defaults to one full page, which is what every current caller relies on', async () => {
    await getCategories();

    expect(mockedGet).toHaveBeenCalledWith('/api/Categories?PageNumber=1&PageSize=100');
  });
});

describe('getCategories — a failed fetch reaches the caller', () => {
  it('rejects rather than resolving to substitute categories', async () => {
    mockedGet.mockRejectedValue(new ApiError(503, 'Service Unavailable'));

    await expect(getCategories()).rejects.toThrow(ApiError);
  });

  it("preserves the server's own diagnosis for the caller to surface", async () => {
    mockedGet.mockRejectedValue(new ApiError(403, 'Forbidden', ['Tenant module not enabled']));

    await expect(getCategories()).rejects.toMatchObject({
      status: 403,
      errors: ['Tenant module not enabled'],
    });
  });
});
