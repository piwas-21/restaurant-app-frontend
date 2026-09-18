import type { ApiResponse } from './common';
import type { PaymentMethod } from './enums';
import type { TableBillDto } from './tableBill';
import type { OrderPaymentDto } from './dtos';

/** Lifecycle values emitted by the durable table-service-session contract (#533). */
export type TableServiceSessionStatus = 'Open' | 'Closed';

/** One durable visit at a table, including every member round in its bill. */
export interface TableServiceSessionDto {
  serviceSessionId: string;
  /** Null for label-only visits (for example a configured "T-QA" table without a number). */
  tableNumber: number | null;
  /** Server-configured display label; empty for plain numbered tables. */
  tableLabel?: string;
  currency?: string | null;
  /** Server lifecycle value; known values are documented by TableServiceSessionStatus. */
  status: string;
  version: number;
  openedAt: string;
  closedAt?: string | null;
  roundCount: number;
  ageMinutes: number;
  outstanding: number;
  /** Server-authoritative debt eligible for a new table tender. */
  eligibleOutstanding?: number;
  /** Server-authoritative action decisions; omitted by pre-follow-up backends. */
  canCollect?: boolean;
  canClose?: boolean;
  hasUnassignedActiveOrders?: boolean;
  legacyActiveOrderCount?: number;
  bill: TableBillDto;
}

/** Idempotent, version-aware tender payload for one table visit. */
export interface AddTableServiceSessionPaymentRequest {
  operationId: string;
  expectedVersion: number;
  paymentMethod: PaymentMethod;
  amount: number;
  currency?: string;
  transactionId?: string;
  referenceNumber?: string;
  cardLastFourDigits?: string;
  cardType?: string;
  paymentNotes?: string;
}

export interface CloseTableServiceSessionRequest {
  expectedVersion: number;
}

export type TableServiceSessionApiResponse = ApiResponse<TableServiceSessionDto>;
export type TableServiceSessionListApiResponse = ApiResponse<TableServiceSessionDto[]>;

/** Read-only result of looking up one table-session payment operation. */
export type TableServiceSessionPaymentOperationStatus = 'Committed' | 'Unknown';

export interface TableServiceSessionPaymentOperationLookupDto {
  operationId: string;
  status: TableServiceSessionPaymentOperationStatus;
  session?: TableServiceSessionDto | null;
  payments: OrderPaymentDto[];
}

export type TableServiceSessionPaymentOperationLookupApiResponse =
  ApiResponse<TableServiceSessionPaymentOperationLookupDto>;
