import { OrderType, type StaffCounterOrderRequest } from '@/types/order';
import { buildOrderItems, type OrderItem } from '@/components/catalog/orderItems';

export interface ServerTakeawayInput {
  readonly items: readonly OrderItem[];
  readonly notes: string;
}

/** Build the fixed Takeaway staff-order payload; table-service fields are intentionally absent. */
export function buildServerTakeawayRequest(input: ServerTakeawayInput): StaffCounterOrderRequest {
  return {
    type: OrderType.Takeaway,
    items: buildOrderItems(input.items),
    notes: input.notes.trim() || undefined,
    paymentState: 'Unpaid',
  };
}
