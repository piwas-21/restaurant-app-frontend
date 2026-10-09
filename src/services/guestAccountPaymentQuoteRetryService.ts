import type { ApiResponse } from '@/types/order';
import type {
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentQuoteRequest,
} from '@/types/guestAccountPayments';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import { apiClient } from '@/utils/apiClient';
import { guestPaymentPath, participantPaymentRequestOptions } from './guestAccountPaymentRequest';
import { readQuoteReplayResponse, requireGuestPaymentOwner } from './guestAccountPaymentValidationService';

export async function retryGuestAccountPaymentQuote(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  expectedCurrency: string,
) {
  await requireGuestPaymentOwner(identity, descriptor);
  const request: GuestAccountPaymentQuoteRequest = {
    operationId: descriptor.operationId,
    ...descriptor.quote,
  };
  const response = await apiClient.post<ApiResponse<unknown>>(
    `${guestPaymentPath(identity.serviceSessionId)}/quotes`,
    request,
    participantPaymentRequestOptions(identity),
  );
  return readQuoteReplayResponse(response, descriptor, expectedCurrency);
}
