import type { ApiResponse } from './order';
import type { AccountPaymentAllocation, AccountPaymentState } from './accountPayments';

export interface GuestOnlinePaymentLimits {
  readonly currency: string;
  readonly minimumAmountMinor: number;
  readonly maximumAmountMinor: number;
}

export interface GuestPaymentEqualShareSlot {
  readonly ordinal: number;
  readonly amountMinor: number;
  readonly claimState: AccountPaymentState | null;
  readonly isAvailable: boolean;
}

export interface GuestPaymentEqualShareSummary {
  readonly planId: string;
  readonly accountRevision: number;
  readonly totalMinor: number;
  readonly shareCount: number;
  readonly currency: string;
  readonly isOwnPlan: boolean;
  readonly slots: readonly GuestPaymentEqualShareSlot[];
  readonly scope: readonly AccountPaymentAllocation[];
}

export interface GuestPaymentAttemptSummary {
  readonly operationId: string | null;
  readonly state: AccountPaymentState;
  readonly version: number;
  readonly paymentMethod: 'Cash' | 'CreditCard' | 'OnlinePayment';
  readonly amountMinor: number;
  readonly currency: string;
  readonly reservationExpiresAt: string | null;
  readonly equalSharePlanId: string | null;
  readonly equalShareOrdinal: number | null;
  readonly isOwnOperation: boolean;
}

export interface GuestAccountPaymentAccount {
  readonly serviceSessionId: string;
  readonly status: 'Open' | 'Closed';
  readonly accountRevision: number;
  readonly currency: string;
  readonly outstandingMinor: number;
  readonly reservedMinor: number;
  readonly availableMinor: number;
  readonly capturedAccountPaymentMinor: number;
  readonly outstandingAllocations: readonly AccountPaymentAllocation[];
  readonly availableAllocations: readonly AccountPaymentAllocation[];
  readonly activeEqualSharePlan: GuestPaymentEqualShareSummary | null;
  readonly activeAttempts: readonly GuestPaymentAttemptSummary[];
  readonly limits: {
    readonly maximumSelectedUnits: number;
    readonly maximumEqualShares: number;
    readonly online: GuestOnlinePaymentLimits | null;
  };
}

export type GuestAccountPaymentAccountResponse = ApiResponse<GuestAccountPaymentAccount>;
