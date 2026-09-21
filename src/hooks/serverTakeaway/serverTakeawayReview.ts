import type { OrderDto, StaffCounterOrderRequest } from '@/types/order';
import { createStaffCounterOrder, quoteStaffCounterOrder } from '@/services/staffCounterOrderService';
import { getErrorMessage } from '@/utils/apiClient';
import { buildServerTakeawayRequest } from './serverTakeawayRequest';
import type { OrderItem } from '@/components/catalog/orderItems';

export interface ServerTakeawayReviewOutcome {
  readonly status: 'committed' | 'refused';
  readonly operationId: string;
  readonly quote?: OrderDto;
  readonly order?: OrderDto;
  readonly error?: string;
}

export async function reviewServerTakeaway(input: {
  readonly items: readonly OrderItem[];
  readonly notes: string;
  readonly storedOperationId?: string;
}): Promise<ServerTakeawayReviewOutcome> {
  const request: StaffCounterOrderRequest = buildServerTakeawayRequest(input);
  const operationId = input.storedOperationId ?? crypto.randomUUID();

  let quote: OrderDto;
  try {
    quote = await quoteStaffCounterOrder(request);
  } catch (error: unknown) {
    return {
      status: 'refused',
      operationId,
      error: getErrorMessage(error) ?? 'server.takeaway.review_failed',
    };
  }

  try {
    const order = await createStaffCounterOrder({
      ...request,
      clientOperationId: operationId,
      releaseToKitchen: true,
    });
    return { status: 'committed', operationId, quote, order };
  } catch (error: unknown) {
    return {
      status: 'refused',
      operationId,
      quote,
      error: getErrorMessage(error) ?? 'server.takeaway.review_failed',
    };
  }
}
