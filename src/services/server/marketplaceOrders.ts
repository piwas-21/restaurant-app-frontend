import { SERVER_ORDER_MAX_PAGES, SERVER_ORDER_PAGE_SIZE } from '@/lib/config';
import { apiClient } from '@/utils/apiClient';
import type { OrderDto, OrderDtoPagedResultApiResponse, PagedResult } from '@/types/order';

function hasMorePages(result: PagedResult<OrderDto>, page: number): boolean {
  return result.hasNextPage === true || result.totalPages > page;
}

/** Fetch all operational marketplace deliveries, then keep only orders Uber has released to kitchen. */
export async function getMarketplaceOperationalOrders(): Promise<OrderDto[]> {
  const itemsById = new Map<string, OrderDto>();
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= SERVER_ORDER_MAX_PAGES) {
    const params = new URLSearchParams({
      scope: 'Operational',
      marketplaceOnly: 'true',
      orderType: 'Delivery',
      page: String(page),
      pageSize: String(SERVER_ORDER_PAGE_SIZE),
    });
    const response = await apiClient.get<OrderDtoPagedResultApiResponse>(`/api/orders?${params}`, {
      requireAuth: true,
    });
    if (!response.data) throw new Error('Failed to fetch marketplace orders');

    const result = response.data;
    for (const order of result.items ?? []) itemsById.set(order.id, order);
    hasNextPage = hasMorePages(result, page);
    if (hasNextPage && result.items.length === 0) break;
    page += 1;
  }

  if (hasNextPage && page > SERVER_ORDER_MAX_PAGES) {
    throw new Error('The marketplace kitchen list is too large to load safely');
  }

  return [...itemsById.values()].filter(
    (order) =>
      order.externalOrder?.provider === 'uber-eats' &&
      order.externalOrder.externalState === 'ACCEPTED' &&
      order.isKitchenReleased &&
      ['Confirmed', 'Preparing', 'Ready'].includes(order.status),
  );
}
