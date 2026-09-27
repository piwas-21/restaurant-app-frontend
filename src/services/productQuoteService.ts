import type { ApiResponse, OrderType } from '@/types/order';
import type { AddToBasketDto } from '@/types/basket';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import { apiClient } from '@/utils/apiClient';

export type ProductQuoteRequest = Omit<AddToBasketDto, 'productId' | 'menuId'>;

export interface ProductQuoteDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** Request a basket-equivalent price without creating a basket or order. */
export async function quoteProduct(
  productId: string,
  request: ProductQuoteRequest,
  requestedOrderType?: OrderType,
): Promise<ProductQuoteDto> {
  const channel = requestedOrderType ? `?requestedOrderType=${encodeURIComponent(requestedOrderType)}` : '';
  const response = await apiClient.post<ApiResponse<ProductQuoteDto>>(
    `/api/Products/${encodeURIComponent(productId)}/quote${channel}`,
    request,
    { requireAuth: true },
  );

  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }

  return response.data;
}
