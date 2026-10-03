import { throwServerRefusal } from '@/utils/apiFormErrors';
import type { ApiResponse } from '@/types/order';
import type { AccountPaymentState } from '@/types/accountPayments';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAccount,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
  GuestPaymentReceipt,
} from '@/types/guestAccountPayments';
import {
  createGuestPaymentContribution,
  validateAccountResponse,
  validateCheckoutResponse,
  validatePaymentOperation,
  validateReceiptResponse,
} from '@/lib/guestAccountPaymentResponse';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';

const ALL_OPERATION_STATES: readonly AccountPaymentState[] = [
  'Quoted',
  'Reserved',
  'Starting',
  'Processing',
  'Captured',
  'CancelRequested',
  'Released',
  'Failed',
  'ReconciliationRequired',
];

export async function readAccountResponse(
  response: ApiResponse<unknown>,
  identity: TableGuestVisitIdentity,
): Promise<GuestAccountPaymentAccount> {
  return validateAccountResponse(readData(response), identity.serviceSessionId);
}

export async function requireGuestPaymentOwner(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): Promise<void> {
  const fingerprint = await fingerprintGuestParticipant(identity.participantToken);
  if (
    identity.serviceSessionId.toLowerCase() !== descriptor.serviceSessionId.toLowerCase() ||
    !fingerprint ||
    fingerprint !== descriptor.participantFingerprint
  )
    throw new Error('The saved guest payment belongs to another participant or visit.');
}

export async function readQuoteResponse(
  response: ApiResponse<unknown>,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  account: GuestAccountPaymentAccount,
) {
  const operation = await validatePaymentOperation(readData(response), descriptor, ['Quoted'], account);
  return { operation, contribution: await createGuestPaymentContribution(operation) };
}

export async function readQuoteReplayResponse(
  response: ApiResponse<unknown>,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  expectedCurrency: string,
) {
  const operation = await readOperationResponse(response, descriptor, ['Quoted']);
  if (operation.currency.toUpperCase() !== expectedCurrency.toUpperCase())
    throw new Error('The saved guest payment currency no longer matches this visit.');
  return { operation, contribution: await createGuestPaymentContribution(operation) };
}

export async function readOperationResponse(
  response: ApiResponse<unknown>,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  allowedStates: readonly AccountPaymentState[] = ALL_OPERATION_STATES,
): Promise<GuestAccountPaymentOperation> {
  return validatePaymentOperation(readData(response), descriptor, allowedStates);
}

export function readCheckoutResponse(
  response: ApiResponse<unknown>,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): GuestAccountCheckoutStatus {
  return validateCheckoutResponse(readData(response), descriptor);
}

export function readReceiptResponse(
  response: ApiResponse<unknown>,
  attemptId: string,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): GuestPaymentReceipt {
  return validateReceiptResponse(readData(response), attemptId, descriptor);
}

function readData(response: ApiResponse<unknown>): unknown {
  if (!response.success || response.data === undefined || response.data === null) throwServerRefusal(response);
  return response.data;
}
