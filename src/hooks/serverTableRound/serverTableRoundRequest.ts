import { OrderType, type CreateStaffRoundCommand } from '@/types/order';
import { buildOrderItems, type OrderItem } from '@/components/catalog/orderItems';

export interface ServerTableRoundInput {
  readonly tableId: string;
  readonly serviceSessionId: string;
  readonly items: readonly OrderItem[];
  readonly notes: string;
  readonly clientOperationId: string;
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
  };
}
