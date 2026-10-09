import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import { validateGuestEqualSharePlan } from '@/lib/guestEqualSharePlanResponse';
import type { ApiResponse } from '@/types/order';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountPaymentAccount,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentQuoteRequest,
  GuestAccountPaymentRecoveryRequest,
  GuestEqualSharePlanRequest,
  GuestEqualSharePlanResponse,
} from '@/types/guestAccountPayments';
import {
  readAccountResponse,
  readCheckoutResponse,
  readOperationResponse,
  readQuoteResponse,
  readReceiptResponse,
  requireGuestPaymentOwner,
} from './guestAccountPaymentValidationService';
import {
  guestPaymentPath,
  guestPaymentRequestOptions,
  participantPaymentRequestOptions,
} from './guestAccountPaymentRequest';
import { retryGuestAccountPaymentQuote } from './guestAccountPaymentQuoteRetryService';

const RECEIPT_HEADER = 'X-Account-Payment-Receipt';
export async function getGuestAccountPaymentAccount(
  identity: TableGuestVisitIdentity,
  signal?: AbortSignal,
): Promise<GuestAccountPaymentAccount> {
  const response = await apiClient.get<ApiResponse<unknown>>(
    guestPaymentPath(identity.serviceSessionId),
    participantPaymentRequestOptions(identity, signal),
  );
  return readAccountResponse(response, identity);
}

export async function createGuestAccountPaymentQuote(
  identity: TableGuestVisitIdentity,
  request: GuestAccountPaymentQuoteRequest,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  account: GuestAccountPaymentAccount,
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const response = await apiClient.post<ApiResponse<unknown>>(
    `${guestPaymentPath(identity.serviceSessionId)}/quotes`,
    request,
    participantPaymentRequestOptions(identity),
  );
  return readQuoteResponse(response, descriptor, account);
}

export async function createGuestEqualSharePlan(
  identity: TableGuestVisitIdentity,
  request: GuestEqualSharePlanRequest,
) {
  const response = await apiClient.post<GuestEqualSharePlanResponse>(
    `${guestPaymentPath(identity.serviceSessionId)}/equal-share-plans`,
    request,
    participantPaymentRequestOptions(identity),
  );
  return validateGuestEqualSharePlan(readData(response), identity.serviceSessionId, request.operationId, {
    accountRevision: request.expectedAccountRevision,
    shareCount: request.shareCount,
  });
}

export async function getGuestEqualSharePlan(identity: TableGuestVisitIdentity, operationId: string) {
  const response = await apiClient.get<GuestEqualSharePlanResponse>(
    `${guestPaymentPath(identity.serviceSessionId)}/equal-share-plans/operations/${encodeURIComponent(operationId)}`,
    participantPaymentRequestOptions(identity),
  );
  return validateGuestEqualSharePlan(readData(response), identity.serviceSessionId, operationId);
}

export async function getGuestAccountPaymentOperation(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  signal?: AbortSignal,
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const response = await apiClient.get<ApiResponse<unknown>>(
    `${guestPaymentPath(identity.serviceSessionId)}/operations/${encodeURIComponent(descriptor.operationId)}`,
    participantPaymentRequestOptions(identity, signal),
  );
  return readOperationResponse(response, descriptor);
}

export async function reserveGuestAccountPayment(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  request: GuestAccountPaymentRecoveryRequest & { readonly expectedAccountRevision: number },
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const response = await apiClient.post<ApiResponse<unknown>>(
    `${guestPaymentPath(identity.serviceSessionId)}/operations/${encodeURIComponent(descriptor.operationId)}/reserve`,
    request,
    participantPaymentRequestOptions(identity),
  );
  return readOperationResponse(response, descriptor, ['Reserved']);
}

export async function releaseGuestAccountPayment(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  expectedVersion: number,
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const response = await apiClient.post<ApiResponse<unknown>>(
    `${guestPaymentPath(identity.serviceSessionId)}/operations/${encodeURIComponent(descriptor.operationId)}/release`,
    { expectedVersion },
    participantPaymentRequestOptions(identity),
  );
  return readOperationResponse(response, descriptor, ['Released']);
}

function checkoutPath(identity: TableGuestVisitIdentity, operationId: string): string {
  return `${guestPaymentPath(identity.serviceSessionId)}/operations/${encodeURIComponent(operationId)}/checkout`;
}

export async function getGuestCheckoutStatus(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  signal?: AbortSignal,
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const response = await apiClient.get<ApiResponse<unknown>>(
    checkoutPath(identity, descriptor.operationId),
    participantPaymentRequestOptions(identity, signal),
  );
  return readCheckoutResponse(response, descriptor);
}

export async function startGuestCheckout(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  expectedVersion: number,
  receiptCredential: string,
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const response = await apiClient.post<ApiResponse<unknown>>(
    checkoutPath(identity, descriptor.operationId),
    { expectedVersion },
    guestPaymentRequestOptions({
      'X-Table-Participant': identity.participantToken,
      [RECEIPT_HEADER]: receiptCredential,
    }),
  );
  return readCheckoutResponse(response, descriptor);
}

export async function requestGuestCheckoutCancellation(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  expectedVersion: number,
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const response = await apiClient.post<ApiResponse<unknown>>(
    `${checkoutPath(identity, descriptor.operationId)}/cancel`,
    { expectedVersion },
    participantPaymentRequestOptions(identity),
  );
  return readCheckoutResponse(response, descriptor);
}

export async function getGuestPaymentReceipt(
  attemptId: string,
  receiptCredential: string,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  signal?: AbortSignal,
) {
  const response = await apiClient.get<ApiResponse<unknown>>(
    `/api/account-payment-receipts/${encodeURIComponent(attemptId)}`,
    guestPaymentRequestOptions({ [RECEIPT_HEADER]: receiptCredential }, signal),
  );
  return readReceiptResponse(response, attemptId, descriptor);
}

function readData<T>(response: { readonly success: boolean; readonly data?: T | null; readonly message?: string }) {
  if (!response.success || response.data === undefined || response.data === null) throwServerRefusal(response);
  return response.data;
}

export const guestAccountPaymentService = {
  getAccount: getGuestAccountPaymentAccount,
  createQuote: createGuestAccountPaymentQuote,
  retryQuote: retryGuestAccountPaymentQuote,
  createEqualSharePlan: createGuestEqualSharePlan,
  getEqualSharePlan: getGuestEqualSharePlan,
  getOperation: getGuestAccountPaymentOperation,
  reserve: reserveGuestAccountPayment,
  release: releaseGuestAccountPayment,
  getCheckoutStatus: getGuestCheckoutStatus,
  startCheckout: startGuestCheckout,
  requestCancellation: requestGuestCheckoutCancellation,
  getReceipt: getGuestPaymentReceipt,
};
