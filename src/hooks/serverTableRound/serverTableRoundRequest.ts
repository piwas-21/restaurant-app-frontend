import { OrderType, type CreateStaffRoundCommand } from '@/types/order';
import { buildOrderItems, type OrderItem } from '@/components/catalog/orderItems';
import type { StaffCustomerSelection } from '@/types/staffCustomer';

export interface ServerTableRoundInput {
  readonly tableId: string;
  readonly serviceSessionId: string;
  readonly items: readonly OrderItem[];
  readonly notes: string;
  readonly clientOperationId: string;
  readonly customer?: StaffCustomerSelection;
  readonly loyaltyEnabled?: boolean;
}

/** Build the exact stable table/session payload; display labels never become table identity. */
export function buildServerTableRoundCommand(input: ServerTableRoundInput): CreateStaffRoundCommand {
  return {
    type: OrderType.DineIn,
    tableId: input.tableId,
    serviceSessionId: input.serviceSessionId,
    paymentState: 'Unpaid',
    releaseToKitchen: true,
    clientOperationId: input.clientOperationId,
    items: buildOrderItems(input.items),
    notes: input.notes.trim() || undefined,
    ...(input.customer?.customerUserId ? { customerUserId: input.customer.customerUserId } : {}),
    ...(input.customer?.customerName ? { customerName: input.customer.customerName } : {}),
    ...(input.customer?.customerEmail ? { customerEmail: input.customer.customerEmail } : {}),
    ...(input.customer?.customerPhone ? { customerPhone: input.customer.customerPhone } : {}),
    ...(input.loyaltyEnabled && input.customer?.customerUserId && input.customer.pointsToRedeem
      ? { pointsToRedeem: input.customer.pointsToRedeem }
      : {}),
  };
}
