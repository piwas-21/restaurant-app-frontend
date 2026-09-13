import type { OrderDto } from './orderDto';

/** One settlement-aware order round in an explicit table-service bill. */
export type TableBillRoundSettlementState = 'EligibleDebt' | 'Settled' | 'Credit' | 'PartiallyRefunded' | 'Refunded';

/** One action exposed by the server for a particular round. */
export interface OrderPermittedActionDto {
  action: string;
  allowed: boolean;
  reasonCode?: string | null;
  requiresReason: boolean;
}

export interface TableBillRoundDto {
  order: OrderDto;
  settlementState: TableBillRoundSettlementState | string;
  outstanding: number;
  refundedAmount: number;
  credit: number;
  canCollect: boolean;
  permittedActions: OrderPermittedActionDto[];
}
