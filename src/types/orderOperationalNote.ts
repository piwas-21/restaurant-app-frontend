/** Internal operational notes are deliberately separate from the guest order DTO. */
export type OrderOperationalNoteAudience = 'Kitchen' | 'Staff';

export interface OrderOperationalNoteDto {
  id: string;
  orderId: string;
  text: string;
  audience: OrderOperationalNoteAudience;
  createdAt: string;
  createdBy: string;
  clientOperationId: string;
}

export interface CreateOrderOperationalNoteCommand {
  text: string;
  audience: OrderOperationalNoteAudience;
  clientOperationId: string;
}
