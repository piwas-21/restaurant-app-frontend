import { clearPendingAccountPayment, type PendingAccountPayment } from './pendingAccountPayment';
import type {
  AccountPaymentOperation,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import { createAccountEqualSharePlan, quoteAccountPayment } from '@/services/accountPaymentsService';
import type { AccountPaymentResult } from './accountPaymentResult';

type RunPayment = (
  saved: PendingAccountPayment,
  action: () => Promise<AccountPaymentResult>,
  write: boolean,
) => Promise<void>;

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
    await input.run(saved, () => quoteAccountPayment(input.serviceSessionId, request), true);
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
