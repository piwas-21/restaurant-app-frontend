import { ApiResponse } from './common';
import { OrderDto } from './orderDto';

/**
 * ONE bill for a dine-in table (waiter/POS): the union of the table's still-open
 * orders — guests order in rounds; the till settles one bill. Mirrors the backend
 * `TableBillDto` (Features/Orders/Dtos). An order is open while its status is
 * neither Completed nor Cancelled.
 */
export interface TableBillDto {
  tableNumber: number;
  /** Explicit durable visit identity; null on the legacy table-number bill. */
  serviceSessionId?: string | null;
  /** Optimistic-concurrency version for an explicit visit. */
  serviceSessionVersion?: number | null;
  /** Currency captured for the visit; null means no currency is declared. */
  currency?: string | null;
  /** True when a legacy table-number lookup cannot identify one visit safely. */
  isAmbiguous?: boolean;
  /** Server clock instant the bill was assembled. */
  generatedAt: string;
  /** Open orders for the table, oldest round first. */
  orders: OrderDto[];
  orderCount: number;
  subTotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
  totalPaid: number;
  /**
   * What the table still owes: per-order outstanding amounts, each clamped at zero,
   * summed — an overpaid order never offsets a sibling's balance.
   */
  remaining: number;
}

export type TableBillApiResponse = ApiResponse<TableBillDto>;
