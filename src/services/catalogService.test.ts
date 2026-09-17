import { apiClient } from '@/utils/apiClient';
import { OrderType } from '@/types/order';
import { getCatalogOfferFamilies } from './catalogService';

const mockedGet = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('getCatalogOfferFamilies — request', () => {
  it('passes paging, category and channel filters to the aggregate endpoint', async () => {
    await getCatalogOfferFamilies({
      page: 2,
      pageSize: 100,
      categoryId: 'cat-tacos',
      requestedOrderType: OrderType.Takeaway,
    });

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/Catalog?page=2&pageSize=100&categoryId=cat-tacos&requestedOrderType=Takeaway',
    );
  });

  it('does not add empty filters when the guest has no category or channel selected', async () => {
    await getCatalogOfferFamilies({ page: 1, pageSize: 100, categoryId: null, requestedOrderType: null });

    expect(mockedGet).toHaveBeenCalledWith('/api/Catalog?page=1&pageSize=100');
  });
});
