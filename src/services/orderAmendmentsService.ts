import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import {
  normalizeAmendmentCommit,
  normalizeAmendmentHistory,
  normalizeAmendmentLookup,
  normalizeAmendmentQuote,
} from './orderAmendmentResponse';
import type {
  OrderAmendmentCommitApiResponse,
  OrderAmendmentCommitRequest,
  OrderAmendmentCommitResult,
  OrderAmendmentHistory,
  OrderAmendmentHistoryApiResponse,
  OrderAmendmentOperationApiResponse,
  OrderAmendmentOperationLookup,
  OrderAmendmentQuote,
  OrderAmendmentQuoteApiResponse,
  OrderAmendmentQuoteRequest,
} from '@/types/orderAmendment';

const ORDER_AMENDMENTS_PATH = '/api/staff/orders';
const OPERATION_PATH = '/api/staff/amendment-operations';

function requireData<T>(response: { success?: boolean; data?: T | null; message?: string }): T {
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  return response.data;
}

export async function quoteOrderAmendment(
  orderId: string,
  request: OrderAmendmentQuoteRequest,
): Promise<OrderAmendmentQuote> {
  const response = await apiClient.post<OrderAmendmentQuoteApiResponse>(
    `${ORDER_AMENDMENTS_PATH}/${encodeURIComponent(orderId)}/amendments/quote`,
    request,
    { requireAuth: true },
  );
  return normalizeAmendmentQuote(requireData(response));
}

export async function commitOrderAmendment(
  orderId: string,
  request: OrderAmendmentCommitRequest,
): Promise<OrderAmendmentCommitResult> {
  const response = await apiClient.post<OrderAmendmentCommitApiResponse>(
    `${ORDER_AMENDMENTS_PATH}/${encodeURIComponent(orderId)}/amendments/commit`,
    request,
    { requireAuth: true },
  );
  return normalizeAmendmentCommit(requireData(response));
}

export async function getOrderAmendmentHistory(orderId: string): Promise<OrderAmendmentHistory[]> {
  const response = await apiClient.get<OrderAmendmentHistoryApiResponse>(
    `${ORDER_AMENDMENTS_PATH}/${encodeURIComponent(orderId)}/amendments`,
    { requireAuth: true },
  );
  return normalizeAmendmentHistory(requireData(response));
}

export async function lookupOrderAmendmentOperation(operationId: string): Promise<OrderAmendmentOperationLookup> {
  const response = await apiClient.get<OrderAmendmentOperationApiResponse>(
    `${OPERATION_PATH}/${encodeURIComponent(operationId)}`,
    { requireAuth: true },
  );
  return normalizeAmendmentLookup(requireData(response));
}
