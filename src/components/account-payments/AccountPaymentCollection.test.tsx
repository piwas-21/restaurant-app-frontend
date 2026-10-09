import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountPaymentCollection from './AccountPaymentCollection';
import { persistPendingAccountPayment, readPendingAccountPayment } from '@/lib/pendingAccountPayment';
import * as service from '@/services/accountPaymentsService';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { AccountCashReceipt, AccountCashSettlement } from '@/types/accountCashSettlement';
import type { AccountCashCollectionIntent } from '@/lib/accountCashCollectionIntent';
import type { TableServiceSessionDto } from '@/types/order';

const translate = (key: string) => key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'en' } }),
}));
jest.mock('@/services/accountPaymentsService', () => ({
  getAccountPaymentAccount: jest.fn(),
  getAccountPaymentOperation: jest.fn(),
  getAccountEqualSharePlan: jest.fn(),
  createAccountEqualSharePlan: jest.fn(),
  quoteAccountPayment: jest.fn(),
  reserveAccountPayment: jest.fn(),
  collectAccountPayment: jest.fn(),
  releaseAccountPayment: jest.fn(),
}));

const api = jest.mocked(service);
const actor = '11111111-1111-4111-8111-111111111111';
const visit = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const request = {
  operationId,
  expectedAccountRevision: 4,
  mode: 'Amount' as const,
  paymentMethod: 'Cash' as const,
  amountMinor: 100,
};
const settlement: AccountCashSettlement = {
  policyVersion: 'chf-cash-5-rappen-v1',
  currency: 'CHF',
  paymentMethod: 'Cash',
  exactAmountMinor: 100,
  adjustmentMinor: 0,
  dueAmountMinor: 100,
};
const receipt: AccountCashReceipt = {
  policyVersion: settlement.policyVersion,
  currency: settlement.currency,
  exactAmountMinor: settlement.exactAmountMinor,
  adjustmentMinor: settlement.adjustmentMinor,
  dueAmountMinor: settlement.dueAmountMinor,
  receivedMinor: 120,
  changeMinor: 20,
  capturedAt: '2026-10-03T12:00:00Z',
};
const intent: AccountCashCollectionIntent = {
  operationId,
  serviceSessionId: visit,
  expectedVersion: 2,
  receivedMinor: 120,
  settlement,
};
const operation: AccountPaymentOperation = {
  serviceSessionId: visit,
  operationId,
  state: 'Reserved',
  version: 2,
  expectedAccountRevision: 4,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 100,
  currency: 'CHF',
  quoteExpiresAt: '2099-10-03T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: '2099-10-03T00:00:00Z',
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [
    {
      orderId: '44444444-4444-4444-8444-444444444444',
      orderItemId: null,
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 100,
      amountMinor: 100,
    },
  ],
  cashSettlement: settlement,
};
const session = {
  serviceSessionId: visit,
  currency: 'CHF',
  bill: {
    serviceSessionId: visit,
    currency: 'CHF',
    accountItems: [],
    orders: [{ id: '44444444-4444-4444-8444-444444444444', orderNumber: 'T-001', items: [] }],
  },
} as unknown as TableServiceSessionDto;

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});

it('keeps check available for a captured cash mismatch and clears only after a matching lookup', async () => {
  const captured: AccountPaymentOperation = {
    ...operation,
    state: 'Captured',
    version: 3,
    cashReceipt: receipt,
  };
  const mismatched = {
    ...captured,
    cashReceipt: { ...receipt, receivedMinor: 119, changeMinor: 19 },
  };
  expect(
    persistPendingAccountPayment({
      actorId: actor,
      serviceSessionId: visit,
      kind: 'payment',
      stage: 'collecting',
      expectedVersion: 2,
      currency: 'CHF',
      cashIntent: intent,
      request,
    }),
  ).toBe(true);
  api.getAccountPaymentOperation.mockResolvedValueOnce(mismatched).mockResolvedValueOnce(captured);
  render(
    <AccountPaymentCollection
      actorId={actor}
      session={session}
      enabled={false}
      disabled
      recoveryEnabled
      onUpdated={jest.fn(async () => undefined)}
    />,
  );

  await waitFor(() => expect(screen.getByText('accountPayments.state.Captured')).toBeInTheDocument());
  expect(readPendingAccountPayment(actor, visit)).toMatchObject({ status: 'pending', value: { cashIntent: intent } });
  expect(screen.getByRole('button', { name: 'accountPayments.check_result' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'accountPayments.retry_original' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.check_result' }));
  await waitFor(() => expect(api.getAccountPaymentOperation).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'none' }));
  expect(api.getAccountPaymentOperation).toHaveBeenCalledTimes(2);
  expect(api.getAccountPaymentAccount).not.toHaveBeenCalled();
});

it('keeps read-only reconciliation available for a legacy captured cash descriptor', async () => {
  const legacyCaptured = {
    ...operation,
    state: 'Captured' as const,
    version: 3,
    cashSettlement: null,
    cashReceipt: null,
  };
  expect(
    persistPendingAccountPayment({
      actorId: actor,
      serviceSessionId: visit,
      kind: 'payment',
      stage: 'collecting',
      expectedVersion: 2,
      currency: 'CHF',
      request,
    }),
  ).toBe(true);
  api.getAccountPaymentOperation.mockResolvedValue(legacyCaptured);
  render(
    <AccountPaymentCollection
      actorId={actor}
      session={session}
      enabled={false}
      disabled
      recoveryEnabled
      onUpdated={jest.fn(async () => undefined)}
    />,
  );

  await waitFor(() => expect(screen.getByText('accountPayments.cash.legacy_unattested')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'accountPayments.check_result' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'accountPayments.retry_original' })).not.toBeInTheDocument();
  expect(readPendingAccountPayment(actor, visit)).toMatchObject({ status: 'pending', value: { stage: 'collecting' } });
});

it.each(['reserved', 'reserving'] as const)(
  'keeps a captured cash lookup unattested and lookupable for a %s descriptor without tender intent',
  async (stage) => {
    const captured: AccountPaymentOperation = {
      ...operation,
      state: 'Captured',
      version: 3,
      cashReceipt: receipt,
    };
    expect(
      persistPendingAccountPayment({
        actorId: actor,
        serviceSessionId: visit,
        kind: 'payment',
        stage,
        expectedVersion: 2,
        currency: 'CHF',
        request,
      }),
    ).toBe(true);
    api.getAccountPaymentOperation.mockResolvedValue(captured);
    render(
      <AccountPaymentCollection
        actorId={actor}
        session={session}
        enabled={false}
        disabled
        recoveryEnabled
        onUpdated={jest.fn(async () => undefined)}
      />,
    );

    await waitFor(() => expect(screen.getByText('accountPayments.state.Captured')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.cash.legacy_unattested'));
    expect(screen.queryByText('cashier.cash_received')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'accountPayments.check_result' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'accountPayments.retry_original' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'accountPayments.record_collection' })).not.toBeInTheDocument();
    expect(readPendingAccountPayment(actor, visit)).toMatchObject({
      status: 'pending',
      value: { stage, request, currency: 'CHF' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'accountPayments.check_result' }));
    await waitFor(() => expect(api.getAccountPaymentOperation).toHaveBeenCalledTimes(2));
    expect(api.collectAccountPayment).not.toHaveBeenCalled();
    expect(api.reserveAccountPayment).not.toHaveBeenCalled();
    expect(api.releaseAccountPayment).not.toHaveBeenCalled();
    expect(readPendingAccountPayment(actor, visit)).toMatchObject({
      status: 'pending',
      value: { stage, request, currency: 'CHF' },
    });
  },
);

it('checks the original operation while feature-off recovery makes no account GET', async () => {
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'collecting',
    expectedVersion: 2,
    currency: 'CHF',
    request,
  });
  api.getAccountPaymentOperation.mockResolvedValue(operation);

  const onUpdated = jest.fn(async () => undefined);
  render(
    <AccountPaymentCollection
      actorId={actor}
      session={session}
      enabled={false}
      disabled
      recoveryEnabled
      onUpdated={onUpdated}
    />,
  );

  await waitFor(() => expect(screen.getByText('accountPayments.state.Reserved')).toBeInTheDocument());
  expect(api.getAccountPaymentOperation).toHaveBeenCalledWith(visit, operationId);
  expect(api.getAccountPaymentAccount).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
});

it('reconciles a saved operation before refreshing the account from the toolbar', async () => {
  const account = {
    serviceSessionId: visit,
    status: 'Open' as const,
    accountRevision: 4,
    currency: 'CHF',
    outstandingMinor: 100,
    reservedMinor: 0,
    availableMinor: 100,
    capturedAccountPaymentMinor: 0,
    outstandingAllocations: [],
    availableAllocations: [],
    activeEqualSharePlan: null,
    activeAttempts: [],
    limits: { maximumSelectedUnits: 20, maximumEqualShares: 10 },
  };
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'collecting',
    expectedVersion: 2,
    currency: 'CHF',
    request,
  });
  api.getAccountPaymentAccount.mockResolvedValue(account);
  api.getAccountPaymentOperation.mockResolvedValue(operation);

  render(
    <AccountPaymentCollection
      actorId={actor}
      session={session}
      enabled
      disabled={false}
      recoveryEnabled
      onUpdated={jest.fn(async () => undefined)}
    />,
  );

  await waitFor(() => {
    expect(api.getAccountPaymentOperation).toHaveBeenCalledTimes(1);
    expect(api.getAccountPaymentAccount).toHaveBeenCalledTimes(2);
  });
  api.getAccountPaymentAccount.mockClear();
  api.getAccountPaymentOperation.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.refresh' }));

  await waitFor(() => {
    expect(api.getAccountPaymentOperation).toHaveBeenCalledTimes(1);
    expect(api.getAccountPaymentAccount).toHaveBeenCalledTimes(1);
  });
  expect(api.getAccountPaymentOperation.mock.invocationCallOrder[0]).toBeLessThan(
    api.getAccountPaymentAccount.mock.invocationCallOrder[0],
  );
});
