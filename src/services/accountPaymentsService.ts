import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type { ApiResponse } from '@/types/order';
import type { AccountPaymentAccount, AccountPaymentAccountResponse } from '@/types/accountPaymentAccount';
import type { CaptureAccountPaymentRequest } from '@/types/accountCashSettlement';
import type {
  AccountEqualSharePlan,
  AccountEqualSharePlanResponse,
  AccountPaymentOperation,
  AccountPaymentResponse,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
  ReserveAccountPaymentRequest,
  VersionedAccountPaymentRequest,
} from '@/types/accountPayments';

function accountPath(serviceSessionId: string): string {
  return `/api/table-service-sessions/${encodeURIComponent(serviceSessionId)}/account-payments`;
}

function operationPath(serviceSessionId: string, operationId: string): string {
  return `${accountPath(serviceSessionId)}/operations/${encodeURIComponent(operationId)}`;
}

function requireData<T>(response: ApiResponse<T>): T {
  if (response.success !== true || response.data === undefined || response.data === null) throwServerRefusal(response);
  return response.data;
}

export async function getAccountPaymentAccount(serviceSessionId: string): Promise<AccountPaymentAccount> {
  return requireData(
    await apiClient.get<AccountPaymentAccountResponse>(accountPath(serviceSessionId), { requireAuth: true }),
  );
}

export async function quoteAccountPayment(
  serviceSessionId: string,
  request: CreateAccountPaymentQuoteRequest,
): Promise<AccountPaymentOperation> {
  return requireData(
    await apiClient.post<AccountPaymentResponse>(`${accountPath(serviceSessionId)}/quotes`, request, {
      requireAuth: true,
    }),
  );
}

export async function createAccountEqualSharePlan(
  serviceSessionId: string,
  request: CreateAccountEqualSharePlanRequest,
): Promise<AccountEqualSharePlan> {
  return requireData(
    await apiClient.post<AccountEqualSharePlanResponse>(`${accountPath(serviceSessionId)}/equal-share-plans`, request, {
      requireAuth: true,
    }),
  );
}

export async function getAccountEqualSharePlan(
  serviceSessionId: string,
  operationId: string,
): Promise<AccountEqualSharePlan> {
  return requireData(
    await apiClient.get<AccountEqualSharePlanResponse>(
      `${accountPath(serviceSessionId)}/equal-share-plans/operations/${encodeURIComponent(operationId)}`,
      { requireAuth: true },
    ),
  );
}

/** Preserve the original operation ID after a lost response; lookup does not replay a money write. */
export async function getAccountPaymentOperation(
  serviceSessionId: string,
  operationId: string,
): Promise<AccountPaymentOperation> {
  return requireData(
    await apiClient.get<AccountPaymentResponse>(operationPath(serviceSessionId, operationId), { requireAuth: true }),
  );
}

export async function reserveAccountPayment(
  serviceSessionId: string,
  operationId: string,
  request: ReserveAccountPaymentRequest,
): Promise<AccountPaymentOperation> {
  return requireData(
    await apiClient.post<AccountPaymentResponse>(`${operationPath(serviceSessionId, operationId)}/reserve`, request, {
      requireAuth: true,
    }),
  );
}

/** Release only after explicit staff confirmation that manually recorded money was not collected. */
export async function releaseAccountPayment(
  serviceSessionId: string,
  operationId: string,
  request: VersionedAccountPaymentRequest,
): Promise<AccountPaymentOperation> {
  return requireData(
    await apiClient.post<AccountPaymentResponse>(`${operationPath(serviceSessionId, operationId)}/release`, request, {
      requireAuth: true,
    }),
  );
}

/** Records physical cash/card collection; the API performs no terminal transaction. */
export async function collectAccountPayment(
  serviceSessionId: string,
  operationId: string,
  request: CaptureAccountPaymentRequest,
): Promise<AccountPaymentOperation> {
  return requireData(
    await apiClient.post<AccountPaymentResponse>(`${operationPath(serviceSessionId, operationId)}/collect`, request, {
      requireAuth: true,
    }),
  );
}
