import type { OrderDto, StaffCounterOrderRequest } from '@/types/order';
import {
  createStaffRound,
  lookupStaffRoundOperation,
  quoteStaffCounterOrder,
} from '@/services/staffCounterOrderService';
import { ApiError, getErrorMessage } from '@/utils/apiClient';
import { buildServerTableRoundCommand } from './serverTableRoundRequest';
import type { OrderItem } from '@/components/catalog/orderItems';

export type ServerTableRoundOutcomeStatus = 'committed' | 'refused' | 'unknown';

export interface ServerTableRoundReviewOutcome {
  readonly status: ServerTableRoundOutcomeStatus;
  readonly operationId: string;
  readonly quote?: OrderDto;
  readonly order?: OrderDto;
  readonly error?: string;
}

function refusalKey(error: ApiError): string {
  switch (error.errorCode) {
    case 'TableServiceSessionNotFound':
    case 'TableServiceSessionRequired':
      return 'server.round.session_required';
    case 'TableServiceSessionStale':
      return 'server.round.stale';
    case 'TableServiceSessionAmbiguous':
      return 'server.round.session_ambiguous';
    case 'KitchenRoleRequired':
    case 'KitchenReleaseRequired':
      return 'server.round.kitchen_permission_required';
    case 'CashierRequired':
    case 'AdminOrCashierRequired':
      return 'server.round.cashier_required';
    case 'OrderVersionConflict':
    case 'StaffOrderVersionConflict':
    case 'TableServiceSessionVersionConflict':
      return 'server.round.version_conflict';
    case 'StaffOrderOperationPayloadMismatch':
      return 'server.round.operation_payload_mismatch';
    case 'StaffOrderOperationIdReused':
      return 'server.round.operation_id_reused';
    default:
      return getErrorMessage(error) ?? 'server.round.review_failed';
  }
}

export async function reconcileServerTableRound(operationId: string): Promise<ServerTableRoundReviewOutcome> {
  try {
    const result = await lookupStaffRoundOperation(operationId);
    return result.status === 'Committed' && result.order
      ? { status: 'committed', operationId, order: result.order }
      : { status: 'unknown', operationId, error: 'server.round.operation_unknown' };
  } catch (error: unknown) {
    return { status: 'unknown', operationId, error: getErrorMessage(error) ?? 'server.round.operation_unknown' };
  }
}

export async function reviewServerTableRound(input: {
  readonly tableId: string;
  readonly serviceSessionId: string;
  readonly items: readonly OrderItem[];
  readonly notes: string;
  readonly storedOperationId?: string;
}): Promise<ServerTableRoundReviewOutcome> {
  const operationId = input.storedOperationId ?? crypto.randomUUID();
  const command = buildServerTableRoundCommand({ ...input, clientOperationId: operationId });
  const { clientOperationId: _operationId, releaseToKitchen: _release, ...quoteRequest } = command;
  let quote: OrderDto;
  try {
    quote = await quoteStaffCounterOrder(quoteRequest as StaffCounterOrderRequest);
  } catch (error: unknown) {
    return {
      status: 'refused',
      operationId,
      error: error instanceof ApiError ? refusalKey(error) : (getErrorMessage(error) ?? 'server.round.review_failed'),
    };
  }

  try {
    const order = await createStaffRound(command);
    return { status: 'committed', operationId, quote, order };
  } catch (error: unknown) {
    const code = error instanceof ApiError ? error.errorCode : undefined;
    if (
      code === 'StaffOrderOperationUnknown' ||
      !(error instanceof ApiError) ||
      error.status === 0 ||
      error.status >= 500
    ) {
      return { status: 'unknown', operationId, quote, error: 'server.round.operation_unknown' };
    }
    return { status: 'refused', operationId, quote, error: refusalKey(error) };
  }
}
