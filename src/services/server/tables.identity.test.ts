import { getTablesWithStatus } from './tables';
import { apiClient } from '@/utils/apiClient';
import { getDineInOrders } from './orders';
import type { OrderDto } from '@/types/order';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/services/tenantTimeService', () => ({ getTenantToday: jest.fn() }));
jest.mock('./orders', () => ({ getDineInOrders: jest.fn() }));

const mockGet = apiClient.get as jest.Mock;
const mockGetDineInOrders = getDineInOrders as jest.Mock;

const table = {
  id: 'table-qa',
  tableNumber: 'T-QA',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 0,
  positionY: 0,
};

const order = (id: string, tableId: string | null, tableNumber: number | null) =>
  ({
    id,
    tableId,
    tableNumber,
    status: 'Pending',
    type: 'DineIn',
    orderDate: '2026-09-16T12:00:00Z',
    items: [],
    total: 10,
  }) as unknown as OrderDto;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({
    success: true,
    data: { items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 },
  });
  mockGetDineInOrders.mockResolvedValue({ items: [] });
});

describe('getTablesWithStatus table identity', () => {
  it('matches alphanumeric tables by stable ID and keeps same-label legacy rows separate', async () => {
    mockGet.mockResolvedValueOnce({ success: true, data: [table] });
    mockGetDineInOrders.mockResolvedValue({
      items: [order('matching', 'table-qa', null), order('other-table', 'table-other', 0), order('legacy', null, 7)],
    });

    const result = await getTablesWithStatus();

    expect(result[0].currentOrders.map((item) => item.id)).toEqual(['matching']);
    expect(result[0].hasActiveOrders).toBe(true);
  });
});
