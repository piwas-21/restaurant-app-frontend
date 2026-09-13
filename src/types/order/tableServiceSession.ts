import type { ApiResponse } from './common';
import type { PaymentMethod } from './enums';
import type { TableBillDto } from './tableBill';

/** Lifecycle values emitted by the durable table-service-session contract (#533). */
export type TableServiceSessionStatus = 'Open' | 'Closed';

/** One durable visit at a table, including every member round in its bill. */
export interface TableServiceSessionDto {
  serviceSessionId: string;
  tableNumber: number;
  currency?: string | null;
  status: TableServiceSessionStatus | string;
  version: number;
  openedAt: string;
  closedAt?: string | null;
  roundCount: number;
  ageMinutes: number;
  outstanding: number;
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
