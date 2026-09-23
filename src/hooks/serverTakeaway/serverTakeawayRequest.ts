import { OrderType, type StaffCounterOrderRequest } from '@/types/order';
import { buildOrderItems, type OrderItem } from '@/components/catalog/orderItems';
import type { StaffCustomerSelection } from '@/types/staffCustomer';

export interface ServerTakeawayInput {
  readonly items: readonly OrderItem[];
  readonly notes: string;
  readonly customer?: StaffCustomerSelection;
  readonly loyaltyEnabled?: boolean;
}

/** Build the fixed Takeaway staff-order payload; table-service fields are intentionally absent. */
export function buildServerTakeawayRequest(input: ServerTakeawayInput): StaffCounterOrderRequest {
  return {
    type: OrderType.Takeaway,
    items: buildOrderItems(input.items),
    notes: input.notes.trim() || undefined,
    ...(input.customer?.customerUserId ? { customerUserId: input.customer.customerUserId } : {}),
    ...(input.customer?.customerName ? { customerName: input.customer.customerName } : {}),
    ...(input.customer?.customerEmail ? { customerEmail: input.customer.customerEmail } : {}),
    ...(input.customer?.customerPhone ? { customerPhone: input.customer.customerPhone } : {}),
    ...(input.loyaltyEnabled && input.customer?.customerUserId && input.customer.pointsToRedeem
      ? { pointsToRedeem: input.customer.pointsToRedeem }
      : {}),
    paymentState: 'Unpaid',
  };
}
