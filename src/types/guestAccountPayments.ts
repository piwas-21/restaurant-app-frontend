import type { ApiResponse } from './order';
import type {
  AccountPaymentAllocation,
  AccountPaymentMode,
  AccountPaymentState,
  AccountPaymentUnitSelection,
} from './accountPayments';
export type {
  GuestAccountPaymentAccount,
  GuestAccountPaymentAccountResponse,
  GuestOnlinePaymentLimits,
  GuestPaymentAttemptSummary,
  GuestPaymentEqualShareSlot,
  GuestPaymentEqualShareSummary,
} from './guestAccountPaymentAccount';

export interface GuestAccountPaymentQuoteRequest {
  readonly operationId: string;
  readonly expectedAccountRevision: number;
  readonly mode: AccountPaymentMode;
  readonly paymentMethod: 'OnlinePayment';
  readonly selectedUnits?: readonly AccountPaymentUnitSelection[];
  readonly amountMinor?: number;
  readonly equalSharePlanId?: string;
  readonly equalShareOrdinal?: number;
}

export interface GuestAccountPaymentOperation {
  readonly serviceSessionId: string;
  readonly operationId: string;
  readonly state: AccountPaymentState;
  readonly version: number;
  readonly expectedAccountRevision: number;
  readonly mode: AccountPaymentMode;
  readonly paymentMethod: 'OnlinePayment';
  readonly amountMinor: number;
  readonly currency: string;
  readonly quoteExpiresAt: string;
  readonly reservedAt: string | null;
  readonly reservationExpiresAt: string | null;
  readonly equalSharePlanId: string | null;
  readonly equalShareOrdinal: number | null;
  readonly allocations: readonly AccountPaymentAllocation[];
}

export interface GuestEqualSharePlan {
  readonly serviceSessionId: string;
  readonly planId: string;
  readonly operationId: string;
  readonly accountRevision: number;
  readonly totalMinor: number;
  readonly shareCount: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly invalidatedAt: string | null;
  readonly scope: readonly AccountPaymentAllocation[];
}

export interface GuestAccountCheckoutStatus {
  readonly attemptId: string;
  readonly operationId: string;
  readonly state: AccountPaymentState;
  readonly version: number;
  readonly amountMinor: number;
  readonly currency: string;
  readonly expiresAt: string;
  readonly checkoutUrl: string | null;
  readonly reconciliationRequired: boolean;
  readonly receivedMinor: number;
  readonly refundedMinor: number;
}

export interface GuestPaymentReceipt {
  readonly attemptId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly state: AccountPaymentState;
  readonly receivedMinor: number;
  readonly refundedMinor: number;
  readonly reconciliationRequired: boolean;
  readonly completedAt: string | null;
  /** Authoritative expiry for this receipt capability; absent on older backends. */
  readonly receiptExpiresAt?: string | null;
}

export type GuestAccountPaymentOperationResponse = ApiResponse<GuestAccountPaymentOperation>;
export type GuestEqualSharePlanResponse = ApiResponse<GuestEqualSharePlan>;
export type GuestAccountCheckoutResponse = ApiResponse<GuestAccountCheckoutStatus>;
export type GuestPaymentReceiptResponse = ApiResponse<GuestPaymentReceipt>;

export interface GuestEqualSharePlanRequest {
  readonly operationId: string;
  readonly expectedAccountRevision: number;
  readonly shareCount: number;
  readonly supersedesPlanId?: string;
}

export interface GuestAccountPaymentRecoveryRequest {
  readonly expectedVersion: number;
}

export interface GuestAccountPaymentQuoteDescriptor {
  readonly expectedAccountRevision: number;
  readonly mode: AccountPaymentMode;
  readonly paymentMethod: 'OnlinePayment';
  readonly selectedUnits?: readonly AccountPaymentUnitSelection[];
  readonly amountMinor?: number;
  readonly equalSharePlanId?: string;
  readonly equalShareOrdinal?: number;
}

export interface GuestAccountPaymentAttemptDescriptor {
  readonly serviceSessionId: string;
  readonly operationId: string;
  /** Missing only on pre-P8 recovery records; those records must not authorize participant API calls. */
  readonly participantFingerprint?: string | null;
  readonly quote: GuestAccountPaymentQuoteDescriptor;
  /** Frozen server quote identity used to reject changed or malformed replay responses. */
  readonly contribution?: {
    readonly amountMinor: number;
    readonly currency: string;
    readonly snapshotFingerprint: string;
  } | null;
  readonly quotedVersion: number | null;
  readonly reservedExpectedVersion: number | null;
  readonly receiptCredential: string | null;
  readonly startRequestedAt: number | null;
  readonly attemptId: string | null;
  readonly receiptExpiresAt?: string | null;
  readonly receiptTerminalState?: AccountPaymentState | null;
  readonly createdAt: number;
}
