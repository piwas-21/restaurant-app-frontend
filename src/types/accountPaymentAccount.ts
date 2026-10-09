import type { ApiResponse } from './order';
import type { AccountPaymentAllocation, AccountPaymentState, AccountPaymentSummaryMethod } from './accountPayments';

export interface AccountEqualShareSlotSummary {
  ordinal: number;
  amountMinor: number;
  claimState: AccountPaymentState | null;
  isAvailable: boolean;
}

export interface AccountEqualShareSummary {
  planId: string;
  accountRevision: number;
  totalMinor: number;
  shareCount: number;
  currency: string;
  isOwnPlan: boolean;
  isCustom?: boolean;
  customAmountsMinor?: number[] | null;
  slots: AccountEqualShareSlotSummary[];
  scope: AccountPaymentAllocation[];
}

export interface AccountPaymentAttemptSummary {
  operationId: string | null;
  state: AccountPaymentState;
  version: number;
  paymentMethod: AccountPaymentSummaryMethod;
  amountMinor: number;
  currency: string;
  reservationExpiresAt: string | null;
  equalSharePlanId: string | null;
  equalShareOrdinal: number | null;
  isOwnOperation: boolean;
}

export interface AccountPaymentAccount {
  serviceSessionId: string;
  status: 'Open' | 'Closed';
  accountRevision: number;
  currency: string;
  outstandingMinor: number;
  reservedMinor: number;
  availableMinor: number;
  capturedAccountPaymentMinor: number;
  outstandingAllocations: AccountPaymentAllocation[];
  availableAllocations: AccountPaymentAllocation[];
  activeEqualSharePlan: AccountEqualShareSummary | null;
  activeAttempts: AccountPaymentAttemptSummary[];
  limits: { maximumSelectedUnits: number; maximumEqualShares: number };
}

export type AccountPaymentAccountResponse = ApiResponse<AccountPaymentAccount>;
