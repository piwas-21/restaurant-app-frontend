import { apiClient } from '@/utils/apiClient';
import type { OrderDto } from '@/types/order';
import { OrderType } from '@/types/order';
import { ACTIVE_ORDER_STATUS_FILTER, getDineInOrders, getServerAmendmentOrders } from './orders';
import { getMarketplaceOperationalOrders } from './marketplaceOrders';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const mockGet = apiClient.get as jest.Mock;

function order(id: string): OrderDto {
  return { id, orderNumber: id, type: 'DineIn', items: [] } as unknown as OrderDto;
}

function page(items: OrderDto[], pageNumber: number, totalPages: number) {
  return {
    success: true,
    data: {
      items,
      totalCount: 3,
      page: pageNumber,
      pageSize: 2,
      totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPreviousPage: pageNumber > 1,
    },
  };
}

describe('getDineInOrders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the default recent-order read bounded to one page', async () => {
    mockGet.mockResolvedValueOnce(page([order('o1'), order('o2')], 1, 20));

    const result = await getDineInOrders();

    expect(result.items.map((item) => item.id)).toEqual(['o1', 'o2']);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('walks every active-order page so the server floor has the complete safety set', async () => {
    mockGet
      .mockResolvedValueOnce(page([order('o1'), order('o2')], 1, 2))
      .mockResolvedValueOnce(page([order('o3')], 2, 2));

    const result = await getDineInOrders({ status: ACTIVE_ORDER_STATUS_FILTER });

    expect(result.items.map((item) => item.id)).toEqual(['o1', 'o2', 'o3']);
    expect(mockGet).toHaveBeenCalledTimes(2);
    const firstParams = new URLSearchParams(mockGet.mock.calls[0][0].split('?')[1]);
    const secondParams = new URLSearchParams(mockGet.mock.calls[1][0].split('?')[1]);
    expect(firstParams.get('page')).toBe('1');
    expect(secondParams.get('page')).toBe('2');
  });

  it('keeps explicit page reads single-page for callers that own pagination', async () => {
    mockGet.mockResolvedValueOnce(page([order('o2')], 2, 3));

    const result = await getDineInOrders({ page: 2, pageSize: 1 });

    expect(result.items.map((item) => item.id)).toEqual(['o2']);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('also follows hasNextPage when a legacy response omits a usable totalPages value', async () => {
    const first = page([order('o1')], 1, 0);
    const second = page([order('o2')], 2, 0);
    first.data.hasNextPage = true;
    second.data.hasNextPage = false;
    mockGet.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const result = await getDineInOrders({ status: ACTIVE_ORDER_STATUS_FILTER });

    expect(result.items.map((item) => item.id)).toEqual(['o1', 'o2']);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('continues when totalPages contradicts a false hasNextPage flag', async () => {
    const first = page([order('o1')], 1, 2);
    const second = page([order('o2')], 2, 2);
    first.data.hasNextPage = false;
    mockGet.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const result = await getDineInOrders({ status: ACTIVE_ORDER_STATUS_FILTER });

    expect(result.items.map((item) => item.id)).toEqual(['o1', 'o2']);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fails closed instead of presenting a truncated order list at the safety limit', async () => {
    const response = page([order('o1')], 1, 0);
    response.data.hasNextPage = true;
    mockGet.mockResolvedValue(response);

    await expect(getDineInOrders({ status: ACTIVE_ORDER_STATUS_FILTER })).rejects.toThrow('too large to load safely');
    expect(mockGet).toHaveBeenCalledTimes(1000);
  });
});

describe('getServerAmendmentOrders', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['All', OrderType.Takeaway, OrderType.Delivery] as const)(
    'requests native Server orders in all-state scope (%s)',
    async (type) => {
      mockGet.mockResolvedValueOnce(page([order('o1')], 1, 1));

      await getServerAmendmentOrders(type);

      const params = new URLSearchParams(mockGet.mock.calls[0][0].split('?')[1]);
      expect(params.get('scope')).toBe('All');
      expect(params.get('page')).toBe('1');
      expect(params.get('pageSize')).toBe('50');
      expect(params.get('orderType')).toBe(type === 'All' ? null : type);
      expect(mockGet.mock.calls[0][1]).toEqual({ requireAuth: true });
    },
  );

  it('applies a server-side search while keeping the selected page bounded', async () => {
    mockGet.mockResolvedValueOnce(page([order('o1')], 2, 3));

    await getServerAmendmentOrders(OrderType.DineIn, 2, 25, '  table 7  ');

    const params = new URLSearchParams(mockGet.mock.calls[0][0].split('?')[1]);
    expect(params.get('scope')).toBe('All');
    expect(params.get('orderType')).toBe(OrderType.DineIn);
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
    expect(params.get('search')).toBe('table 7');
  });
});

describe('getMarketplaceOperationalOrders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the server marketplace queue and keeps only accepted, kitchen-released work across pages', async () => {
    const accepted = {
      ...marketplaceOrder(),
      id: 'accepted',
      status: 'Confirmed',
      isKitchenReleased: true,
      externalOrder: { ...marketplaceOrder().externalOrder!, externalState: 'ACCEPTED' },
    };
    const pending = marketplaceOrder();
    pending.id = 'pending';
    const makePage = (items: OrderDto[], pageNumber: number, totalPages: number) => ({
      success: true,
      data: {
        items,
        totalCount: 2,
        page: pageNumber,
        pageSize: 50,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
    mockGet.mockResolvedValueOnce(makePage([pending], 1, 2)).mockResolvedValueOnce(makePage([accepted], 2, 2));

    await expect(getMarketplaceOperationalOrders()).resolves.toEqual([accepted]);
    expect(mockGet).toHaveBeenCalledTimes(2);
    const params = new URLSearchParams(mockGet.mock.calls[0][0].split('?')[1]);
    expect(params.get('scope')).toBe('Operational');
    expect(params.get('marketplaceOnly')).toBe('true');
    expect(params.get('orderType')).toBe('Delivery');
    expect(new URLSearchParams(mockGet.mock.calls[1][0].split('?')[1]).get('page')).toBe('2');
  });
});
