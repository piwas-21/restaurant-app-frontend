import type { ApiResponse, CreateOrderItemDto, OrderItemDto } from './order';
import type { OrderDto } from './order/orderDto';
import type { AmendmentResolutionLoyaltyResult } from '@/schemas/amendmentResolutionLoyalty.schema';

/** Amendment lines may reference either a ProductId or MenuId, as the backend accepts both. */
export type OrderAmendmentItemDto = Omit<CreateOrderItemDto, 'productId' | 'menuId' | 'childItems'> & {
  productId?: string;
  menuId?: string;
  childItems?: OrderAmendmentItemDto[];
};

export type OrderAmendmentChangeKind = 'Void' | 'Replace' | 'InstructionChange';
export type OrderAmendmentResolution = 'NotRequired' | 'Pending' | 'Resolved';
export type OrderAmendmentCreditState = 'None' | 'BalanceReduction' | 'PendingAllocationReview' | 'Resolved';
export type OrderAmendmentLoyaltyState = 'None' | 'PendingReview' | 'Resolved';
export type OrderAmendmentRefundState =
  'None' | 'PendingTillRefund' | 'GatewayRefundRequired' | 'CustodianReviewRequired' | 'Resolved';

export interface OrderAmendmentLineChangeRequest {
  orderItemId: string;
  kind: OrderAmendmentChangeKind;
  startOrdinal: number;
  quantity: number;
  current?: OrderAmendmentItemDto | null;
}

export interface OrderAmendmentQuoteRequest {
  expectedOrderVersion: number;
  expectedAccountRevision?: number;
  reason?: string;
  reviewAcknowledged: boolean;
  preparingOverrideAcknowledged: boolean;
  releaseAdditionsToKitchen: boolean;
  localProviderSupplementConsent: boolean;
  providerConsentNote?: string;
  pointsToRedeem?: number;
  additions: OrderAmendmentItemDto[];
  changes: OrderAmendmentLineChangeRequest[];
}

export interface OrderAmendmentCommitRequest {
  amendmentId: string;
  clientOperationId: string;
  expectedOrderVersion: number;
  expectedAccountRevision?: number;
  reviewAcknowledged: boolean;
}

export interface OrderAmendmentChangeSnapshot {
  orderItemId: string;
  kind: OrderAmendmentChangeKind;
  startOrdinal: number;
  quantity: number;
  wholeLine: boolean;
  previous: OrderItemDto;
  current?: OrderItemDto | null;
  replacementDispatchedOrderId?: string | null;
  replacementDispatchedOrderNumber?: string | null;
}

export interface OrderAmendmentFinancialPreview {
  loyalty?: AmendmentResolutionLoyaltyResult | null;
  currency?: string | null;
  addedAmountMinor: number;
  removedUnitValueMinor: number;
  netAccountDeltaMinor: number;
  potentialCreditMinor: number;
  resolutionStatus: OrderAmendmentResolution;
  creditState: OrderAmendmentCreditState;
  loyaltyState: OrderAmendmentLoyaltyState;
  refundState: OrderAmendmentRefundState;
}

export interface OrderAmendmentQuote {
  amendmentId: string;
  sourceOrderId: string;
  serviceSessionId?: string | null;
  expectedOrderVersion: number;
  expectedAccountRevision?: number | null;
  expiresAt: string;
  sourceOrder: OrderDto;
  supplementOrder?: OrderDto | null;
  changes: OrderAmendmentChangeSnapshot[];
  financialPreview: OrderAmendmentFinancialPreview;
  providerProcedure?: string | null;
}

export interface OrderAmendmentCommitResult {
  amendmentId: string;
  clientOperationId: string;
  sourceOrderId: string;
  supplementOrderId?: string | null;
  committedAccountRevision?: number | null;
  committedAt: string;
  financialResolution: OrderAmendmentFinancialPreview;
  supplementOrder?: OrderDto | null;
}

export interface OrderAmendmentOperationLookup {
  operationId: string;
  status: 'Unknown' | 'Committed' | 0 | 1;
  result?: OrderAmendmentCommitResult | null;
}

export type OrderAmendmentQuoteApiResponse = ApiResponse<OrderAmendmentQuote>;
export type OrderAmendmentCommitApiResponse = ApiResponse<OrderAmendmentCommitResult>;
export type OrderAmendmentHistoryApiResponse = ApiResponse<OrderAmendmentHistory[]>;
export type OrderAmendmentOperationApiResponse = ApiResponse<OrderAmendmentOperationLookup>;

export interface OrderAmendmentHistory {
  amendmentId: string;
  sourceOrderId: string;
  serviceSessionId?: string | null;
  supplementOrderId?: string | null;
  actorRole: string;
  state: string;
  createdAt: string;
  committedAt?: string | null;
  supplementOrder?: OrderDto | null;
  changes: OrderAmendmentChangeSnapshot[];
  financialResolution: OrderAmendmentFinancialPreview;
}
