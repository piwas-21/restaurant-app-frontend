import { accountPaymentMutationActions } from './accountPaymentMutationActions';
import type { AccountCashSettlement } from '@/types/accountCashSettlement';
import type { AccountPaymentOperation, CreateAccountPaymentQuoteRequest } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';
import type { AccountPaymentResult } from './accountPaymentResult';

const actorId = '11111111-1111-4111-8111-111111111111';
const serviceSessionId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const requestedOrderId = '44444444-4444-4444-8444-444444444444';
const requestedItemId = '55555555-5555-4555-8555-555555555555';
const returnedItemId = '66666666-6666-4666-8666-666666666666';
const settlement: AccountCashSettlement = {
  policyVersion: 'chf-cash-5-rappen-v1',
  currency: 'CHF',
  paymentMethod: 'Cash',
  exactAmountMinor: 333,
  adjustmentMinor: 2,
  dueAmountMinor: 335,
};
const request: CreateAccountPaymentQuoteRequest = {
  operationId,
  expectedAccountRevision: 4,
  mode: 'Items',
  paymentMethod: 'Cash',
  selectedUnits: [{ orderId: requestedOrderId, orderItemId: requestedItemId, ordinal: 1 }],
};
const pending: PendingAccountPayment = {
  actorId,
  serviceSessionId,
  kind: 'payment',
  stage: 'reserved',
  expectedVersion: 2,
  currency: 'CHF',
  request,
};
const reservedOperation: AccountPaymentOperation = {
  serviceSessionId,
  operationId,
  state: 'Reserved',
  version: 2,
  expectedAccountRevision: 4,
  mode: 'Items',
  paymentMethod: 'Cash',
  amountMinor: 333,
  currency: 'CHF',
  quoteExpiresAt: '2099-10-03T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: '2099-10-03T00:00:00Z',
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [
    {
      orderId: requestedOrderId,
      orderItemId: returnedItemId,
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 333,
      amountMinor: 333,
    },
  ],
  cashSettlement: settlement,
};

it('refuses to reserve or collect cash when returned allocations differ from the original item request', async () => {
  const run = jest.fn(
    async (_saved: PendingAccountPayment, _action: () => Promise<AccountPaymentResult>, _write: boolean) => undefined,
  );
  const actions = accountPaymentMutationActions(
    pending,
    reservedOperation,
    serviceSessionId,
    'CHF',
    run,
    actorId,
    true,
    true,
    false,
    false,
  );

  await actions.collect(400);
  expect(run).not.toHaveBeenCalled();

  const quotedOperation = { ...reservedOperation, state: 'Quoted' as const, version: 1 };
  const review = accountPaymentMutationActions(
    { ...pending, stage: 'review', expectedVersion: 1 },
    quotedOperation,
    serviceSessionId,
    'CHF',
    run,
    actorId,
    true,
    true,
    false,
    false,
  );
  await review.reserve();
  expect(run).not.toHaveBeenCalled();
});
