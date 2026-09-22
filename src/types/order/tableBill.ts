import { ApiResponse } from './common';
import { OrderDto } from './orderDto';
import type { TableBillRoundDto } from './tableBillRound';

/**
 * ONE bill for a dine-in table (waiter/POS): the union of the table's still-open
 * orders — guests order in rounds; the till settles one bill. Mirrors the backend
 * `TableBillDto` (Features/Orders/Dtos). An order is open while its status is
 * neither Completed nor Cancelled.
 */
export interface TableBillDto {
  /** Stable configured table identity, when the bill belongs to a physical table. */
  tableId?: string | null;
  /** Null for label-only visits; the session's tableLabel carries the display name then. */
  tableNumber: number | null;
  /** Server-configured table label, including non-numeric labels. */
  tableLabel?: string | null;
  /** Explicit durable visit identity; null on the legacy table-number bill. */
  serviceSessionId?: string | null;
  /** Optimistic-concurrency version for an explicit visit. */
  serviceSessionVersion?: number | null;
  /** Currency captured for the visit; null means no currency is declared. */
  currency?: string | null;
  /** True when a legacy table-number lookup cannot identify one visit safely. */
  isAmbiguous?: boolean;
  /** Settlement-annotated rounds, oldest first. Present on the explicit table-session contract. */
  rounds?: TableBillRoundDto[];
  /** Outstanding amount on rounds currently eligible for collection. */
  eligibleOutstanding?: number;
  /** Net overpayment credit across the bill's rounds. */
  credit?: number;
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
