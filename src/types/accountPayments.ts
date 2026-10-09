import type { ApiResponse } from './order';
import type { AccountCashReceipt, AccountCashSettlement } from './accountCashSettlement';

export type AccountPaymentState =
  | 'Quoted'
  | 'Reserved'
  | 'Starting'
  | 'Processing'
  | 'Captured'
  | 'CancelRequested'
  | 'Released'
  | 'Failed'
  | 'ReconciliationRequired';
export const ACCOUNT_PAYMENT_MODES = ['Items', 'Amount', 'Equal', 'CustomAmount', 'Full'] as const;
export type AccountPaymentMode = (typeof ACCOUNT_PAYMENT_MODES)[number];
export type AccountManualPaymentMethod = 'Cash' | 'CreditCard';
export type AccountPaymentSummaryMethod = AccountManualPaymentMethod | 'OnlinePayment';

export interface AccountPaymentAllocation {
  orderId: string;
  orderItemId: string | null;
  startOrdinal: number;
  unitCount: number;
  minorPerUnit: number;
  amountMinor: number;
}

export interface AccountPaymentUnitSelection {
  orderId: string;
  orderItemId: string;
  ordinal: number;
}

export interface AccountPaymentOperation {
  serviceSessionId: string;
  operationId: string;
  state: AccountPaymentState;
  version: number;
  expectedAccountRevision: number;
  mode: AccountPaymentMode;
  paymentMethod: AccountManualPaymentMethod;
  amountMinor: number;
  currency: string;
  quoteExpiresAt: string;
  reservedAt: string | null;
  reservationExpiresAt: string | null;
  equalSharePlanId: string | null;
  equalShareOrdinal: number | null;
  customSharePlanId?: string | null;
  customShareOrdinal?: number | null;
  allocations: AccountPaymentAllocation[];
  tipMinor?: number;
  cashSettlement?: AccountCashSettlement | null;
  cashReceipt?: AccountCashReceipt | null;
}

export interface AccountEqualSharePlan {
  serviceSessionId: string;
  planId: string;
  operationId: string;
  accountRevision: number;
  totalMinor: number;
  shareCount: number;
  currency: string;
  createdAt: string;
  invalidatedAt: string | null;
  scope: AccountPaymentAllocation[];
  customAmountsMinor?: number[] | null;
}

export interface CreateAccountPaymentQuoteRequest {
  operationId: string;
  expectedAccountRevision: number;
  mode: AccountPaymentMode;
  paymentMethod: AccountManualPaymentMethod;
  selectedUnits?: AccountPaymentUnitSelection[];
  amountMinor?: number;
  equalSharePlanId?: string;
  equalShareOrdinal?: number;
  customSharePlanId?: string;
  customShareOrdinal?: number;
  tipMinor?: number;
}

export interface CreateAccountEqualSharePlanRequest {
  operationId: string;
  expectedAccountRevision: number;
  shareCount: number;
  supersedesPlanId?: string;
  customAmountsMinor?: number[];
}

export interface ReserveAccountPaymentRequest {
  expectedVersion: number;
  expectedAccountRevision: number;
}

export interface VersionedAccountPaymentRequest {
  expectedVersion: number;
}
export type AccountPaymentResponse = ApiResponse<AccountPaymentOperation>;
export type AccountEqualSharePlanResponse = ApiResponse<AccountEqualSharePlan>;
