import { clearPendingAccountPayment, type PendingAccountPayment } from './pendingAccountPayment';
import type {
  AccountPaymentOperation,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import {
  createAccountEqualSharePlan,
  quoteAccountPayment,
  reserveAccountPayment,
} from '@/services/accountPaymentsService';
import type { AccountPaymentResult } from './accountPaymentResult';
import { readAccountCashEvidence } from './accountCashEvidence';
import { hasConsistentFrozenAmount, matchesRequestedItemScope } from './accountPaymentRecoveryScope';

type RunPayment = (
  saved: PendingAccountPayment,
  action: () => Promise<AccountPaymentResult>,
  write: boolean,
) => Promise<AccountPaymentResult | undefined>;

interface DraftActionsInput {
  readonly actorId: string | undefined;
  readonly serviceSessionId: string;
  readonly ready: boolean;
  readonly pending: PendingAccountPayment | null;
  readonly operation: AccountPaymentOperation | null;
  readonly busy: boolean;
  readonly run: RunPayment;
  readonly setPending: (pending: PendingAccountPayment | null) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
  readonly clearError: () => void;
  readonly showError: (message: string) => void;
  readonly storageUnavailableMessage: string;
  readonly visitCurrency: string | null;
}

function isReservableQuote(
  result: AccountPaymentResult | undefined,
  saved: Extract<PendingAccountPayment, { kind: 'payment' }>,
  serviceSessionId: string,
  visitCurrency: string | null,
): result is AccountPaymentOperation {
  if (!result || 'planId' in result || result.state !== 'Quoted' || !visitCurrency) return false;
  const request = saved.request;
  return (
    result.operationId.toLowerCase() === request.operationId.toLowerCase() &&
    result.serviceSessionId.toLowerCase() === serviceSessionId.toLowerCase() &&
    result.expectedAccountRevision === request.expectedAccountRevision &&
    result.currency === visitCurrency &&
    result.mode === request.mode &&
    result.paymentMethod === request.paymentMethod &&
    (result.tipMinor ?? 0) === (request.tipMinor ?? 0) &&
    Number.isSafeInteger(result.version) &&
    result.version > 0 &&
    Number.isSafeInteger(result.amountMinor) &&
    result.amountMinor > 0 &&
    (request.mode !== 'Amount' || result.amountMinor === request.amountMinor) &&
    (request.mode !== 'Equal' ||
      (result.equalSharePlanId === request.equalSharePlanId &&
        result.equalShareOrdinal === request.equalShareOrdinal)) &&
    (request.mode !== 'CustomAmount' ||
      (result.customSharePlanId === request.customSharePlanId &&
        result.customShareOrdinal === request.customShareOrdinal)) &&
    hasConsistentFrozenAmount(result) &&
    (request.mode !== 'Items' || matchesRequestedItemScope(saved, result)) &&
    (result.paymentMethod !== 'Cash' || readAccountCashEvidence(result).status === 'valid')
  );
}

export function createAccountPaymentDraftActions(input: DraftActionsInput) {
  const quote = async (request: CreateAccountPaymentQuoteRequest) => {
    if (!input.actorId || !input.ready || input.pending) return;
    const saved: PendingAccountPayment = {
      actorId: input.actorId,
      serviceSessionId: input.serviceSessionId,
      kind: 'payment',
      request,
      stage: 'quote',
    };
    const quoted = await input.run(saved, () => quoteAccountPayment(input.serviceSessionId, request), true);
    if (!isReservableQuote(quoted, saved, input.serviceSessionId, input.visitCurrency)) return;
    const reservation: PendingAccountPayment = {
      ...saved,
      stage: 'reserving',
      expectedVersion: quoted.version,
      currency: quoted.currency,
    };
    await input.run(
      reservation,
      () =>
        reserveAccountPayment(input.serviceSessionId, quoted.operationId, {
          expectedVersion: quoted.version,
          expectedAccountRevision: quoted.expectedAccountRevision,
        }),
      true,
    );
  };

  const plan = async (request: CreateAccountEqualSharePlanRequest) => {
    if (!input.actorId || !input.ready || input.pending) return;
    const saved: PendingAccountPayment = {
      actorId: input.actorId,
      serviceSessionId: input.serviceSessionId,
      kind: 'plan',
      request,
    };
    await input.run(saved, () => createAccountEqualSharePlan(input.serviceSessionId, request), true);
  };

  const retryPreview = async () => {
    const pending = input.pending;
    if (!pending || input.operation || (pending.kind === 'payment' && pending.stage !== 'quote')) return;
    const action =
      pending.kind === 'plan'
        ? () => createAccountEqualSharePlan(input.serviceSessionId, pending.request)
        : () => quoteAccountPayment(input.serviceSessionId, pending.request);
    await input.run(pending, action, true);
  };

  const discardPreview = () => {
    const pending = input.pending;
    if (!input.actorId || input.busy || pending?.kind !== 'payment' || pending.stage !== 'quote' || input.operation)
      return;
    if (clearPendingAccountPayment(input.actorId, input.serviceSessionId, pending.request.operationId)) {
      input.setPending(null);
      input.clearError();
      return;
    }
    input.setStorageUnavailable(true);
    input.showError(input.storageUnavailableMessage);
  };

  return { quote, plan, retryPreview, discardPreview };
}
