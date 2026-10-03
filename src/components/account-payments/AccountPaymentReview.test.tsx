import { fireEvent, render, screen } from '@testing-library/react';
import AccountPaymentReview from './AccountPaymentReview';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from '@/lib/pendingAccountPayment';
import type { TableServiceSessionDto } from '@/types/order';

const translate = (key: string, values?: Record<string, unknown>) =>
  values
    ? `${key}:${Object.entries(values)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')}`
    : key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate, i18n: { language: 'en' } }) }));
const orderId = '55555555-5555-4555-8555-555555555555';
const itemId = '66666666-6666-4666-8666-666666666666';
const operation: AccountPaymentOperation = {
  serviceSessionId: '22222222-2222-4222-8222-222222222222',
  operationId: '33333333-3333-4333-8333-333333333333',
  state: 'Reserved',
  version: 2,
  expectedAccountRevision: 7,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 29,
  currency: 'EUR',
  quoteExpiresAt: '2099-10-03T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: '2099-10-03T00:00:00Z',
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [
    { orderId, orderItemId: itemId, startOrdinal: 2, unitCount: 2, minorPerUnit: 14, amountMinor: 28 },
    { orderId, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 1, amountMinor: 1 },
  ],
};
const session = {
  serviceSessionId: operation.serviceSessionId,
  bill: {
    accountItems: [
      {
        orderId,
        orderNumber: 'T-017',
        orderItemId: itemId,
        itemSnapshot: {
          id: itemId,
          productId: '77777777-7777-4777-8777-777777777777',
          productName: 'Tomato soup',
          variationName: 'Large',
          quantity: 4,
          unitPrice: 14,
          itemTotal: 56,
        },
        unitCount: 4,
      },
    ],
    orders: [
      { id: orderId, orderNumber: 'T-017', items: [] },
      {
        id: '88888888-8888-4888-8888-888888888888',
        orderNumber: 'T-016',
        items: [{ id: '99999999-9999-4999-8999-999999999999', productName: 'Earlier order item' }],
      },
    ],
  },
} as unknown as TableServiceSessionDto;
const pending: PendingAccountPayment = {
  actorId: '11111111-1111-4111-8111-111111111111',
  serviceSessionId: operation.serviceSessionId,
  kind: 'payment',
  stage: 'reserved',
  expectedVersion: 2,
  request: {
    operationId: operation.operationId,
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'Cash',
    amountMinor: 29,
  },
};
const handlers = {
  onReserve: jest.fn(async () => undefined),
  onCollect: jest.fn(async () => undefined),
  onRelease: jest.fn(async () => undefined),
  onCheck: jest.fn(async () => undefined),
};
beforeEach(() => jest.clearAllMocks());

function renderReview(
  overrides: {
    readonly operation?: AccountPaymentOperation;
    readonly pending?: PendingAccountPayment | null;
    readonly disabled?: boolean;
    readonly recoveryReleaseEnabled?: boolean;
    readonly session?: TableServiceSessionDto;
  } = {},
) {
  return render(
    <AccountPaymentReview
      session={overrides.session ?? session}
      operation={overrides.operation ?? operation}
      pending={overrides.pending === undefined ? pending : overrides.pending}
      disabled={overrides.disabled ?? false}
      recoveryReleaseEnabled={overrides.recoveryReleaseEnabled ?? !overrides.disabled}
      {...handlers}
    />,
  );
}

it('requires sufficient exact cash and physical collection confirmation before recording', () => {
  renderReview();
  const collect = screen.getByRole('button', { name: 'accountPayments.record_collection' });
  expect(collect).toBeDisabled();
  fireEvent.change(screen.getByLabelText('cashier.cash_received'), { target: { value: '0.28' } });
  fireEvent.click(screen.getByLabelText('accountPayments.physical_collection_confirm'));
  expect(collect).toBeDisabled();
  fireEvent.change(screen.getByLabelText('cashier.cash_received'), { target: { value: '1,00' } });
  expect(screen.getByRole('status')).toHaveTextContent('€0.71');
  expect(collect).toBeEnabled();
  fireEvent.click(collect);
  expect(handlers.onCollect).toHaveBeenCalledTimes(1);
});

it('shows the frozen order, line, and one-based unit range without unrelated bill items', () => {
  renderReview();
  const scope = screen.getByRole('list', { name: 'accountPayments.frozen_scope' });
  expect(scope).toHaveTextContent('T-017');
  expect(scope).toHaveTextContent('Tomato soup · Large');
  const lines = screen.getAllByRole('listitem');
  expect(lines[0]).toHaveTextContent('accountPayments.unit_range:first=2,last=3 · €0.28');
  expect(lines[1]).toHaveTextContent('accountPayments.shared_charge');
  expect(lines[1]).toHaveTextContent('accountPayments.unit_range:first=1,last=1 · €0.01');
  expect(scope).not.toHaveTextContent('Earlier order item');
  expect(screen.getByText('accountPayments.mode_amount')).toBeInTheDocument();
});

it('shows the exact partial amount assigned to a custom contribution line', () => {
  const partial = {
    ...operation,
    amountMinor: 14,
    allocations: [{ orderId, orderItemId: itemId, startOrdinal: 3, unitCount: 1, minorPerUnit: 14, amountMinor: 14 }],
  };
  renderReview({ operation: partial });
  expect(screen.getByRole('listitem')).toHaveTextContent('accountPayments.unit_range:first=3,last=3 · €0.14');
});

it('fails closed when a line product does not equal its frozen allocation amount', () => {
  const inconsistent = {
    ...operation,
    allocations: [
      { ...operation.allocations[0], amountMinor: 27 },
      { ...operation.allocations[1], minorPerUnit: 2, amountMinor: 2 },
    ],
  };
  renderReview({ operation: inconsistent });
  expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.scope_unavailable');
  expect(screen.getByRole('button', { name: 'accountPayments.record_collection' })).toBeDisabled();
});

it('fails closed when an allocation has non-positive minor-unit pricing', () => {
  const invalidAmount = {
    ...operation,
    amountMinor: 1,
    allocations: [{ ...operation.allocations[0], startOrdinal: 1, unitCount: 1, minorPerUnit: 0, amountMinor: 1 }],
  };
  renderReview({ operation: invalidAmount });
  expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.scope_unavailable');
  expect(screen.getByRole('button', { name: 'accountPayments.record_collection' })).toBeDisabled();
});

it('fails closed when valid line allocations do not sum to the quoted total', () => {
  renderReview({ operation: { ...operation, amountMinor: 28 } });
  expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.scope_unavailable');
  expect(screen.getByRole('button', { name: 'accountPayments.record_collection' })).toBeDisabled();
});

it('fails closed on missing frozen line snapshots instead of claiming generic reviewed items', () => {
  const missingSnapshot = { ...session, bill: { ...session.bill, accountItems: undefined } } as TableServiceSessionDto;
  const { rerender } = renderReview({ session: missingSnapshot });
  expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.scope_unavailable');
  expect(screen.queryByText('accountPayments.frozen_review')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'accountPayments.record_collection' })).toBeDisabled();

  rerender(
    <AccountPaymentReview
      session={missingSnapshot}
      operation={{ ...operation, state: 'Quoted' }}
      pending={{ ...pending, stage: 'review' }}
      disabled={false}
      {...handlers}
    />,
  );
  expect(screen.getByRole('button', { name: 'accountPayments.reserve' })).toBeDisabled();
});

it('fails closed when the frozen source line cannot cover the quoted ordinal range', () => {
  const shortSnapshot = {
    ...session,
    bill: { ...session.bill, accountItems: [{ ...session.bill.accountItems?.[0], unitCount: 2 }] },
  } as TableServiceSessionDto;
  renderReview({ session: shortSnapshot });
  expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.scope_unavailable');
  expect(screen.getByRole('button', { name: 'accountPayments.record_collection' })).toBeDisabled();
});

it('identifies the exact equal-share ordinal as well as the source allocation', () => {
  renderReview({ operation: { ...operation, mode: 'Equal', equalShareOrdinal: 3 } });
  expect(screen.getByText('accountPayments.mode_equal')).toBeInTheDocument();
  expect(screen.getByText('accountPayments.share_number:number=3')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'accountPayments.frozen_scope' })).toHaveTextContent('Tomato soup · Large');
});

it('labels a frozen shared charge by its source order without pretending it is a menu item', () => {
  const sharedCharge: AccountPaymentOperation = {
    ...operation,
    allocations: [{ orderId, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 29, amountMinor: 29 }],
  };
  renderReview({ operation: sharedCharge });
  const scope = screen.getByRole('list', { name: 'accountPayments.frozen_scope' });
  expect(scope).toHaveTextContent('T-017');
  expect(scope).toHaveTextContent('accountPayments.shared_charge');
  expect(scope).toHaveTextContent('accountPayments.unit_range:first=1,last=1');
  expect(scope).not.toHaveTextContent('Tomato soup');
});

it('leaves an expired reservation locked but allows explicit no-money release and status lookup', () => {
  render(
    <AccountPaymentReview
      session={session}
      operation={{ ...operation, reservationExpiresAt: '2000-01-01T00:00:00Z' }}
      pending={pending}
      disabled={false}
      recoveryReleaseEnabled
      {...handlers}
    />,
  );
  expect(screen.getByRole('button', { name: 'accountPayments.record_collection' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('accountPayments.no_money_collected'));
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.release' }));
  expect(handlers.onRelease).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.check_result' }));
  expect(handlers.onCheck).toHaveBeenCalledTimes(1);
});

it('does not ask to collect physical money again when the original collection response is unknown', () => {
  render(
    <AccountPaymentReview
      session={session}
      operation={operation}
      pending={{ ...pending, stage: 'collecting' }}
      disabled={false}
      recoveryCollectionEnabled
      {...handlers}
    />,
  );
  expect(screen.queryByLabelText('cashier.cash_received')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'accountPayments.release' })).not.toBeInTheDocument();
  expect(screen.getByText('accountPayments.result_unknown')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.retry_original' }));
  expect(handlers.onCollect).toHaveBeenCalledTimes(1);
});

it('requires card confirmation from the standalone terminal and never claims to initiate a charge', () => {
  render(
    <AccountPaymentReview
      session={session}
      operation={{ ...operation, paymentMethod: 'CreditCard' }}
      pending={pending}
      disabled={false}
      {...handlers}
    />,
  );
  expect(screen.getByText('cashier.standalone_card_instruction')).toBeInTheDocument();
  expect(screen.queryByLabelText('cashier.cash_received')).not.toBeInTheDocument();
  const collect = screen.getByRole('button', { name: 'accountPayments.record_collection' });
  expect(collect).toBeDisabled();
  fireEvent.click(screen.getByLabelText('accountPayments.physical_collection_confirm'));
  fireEvent.click(collect);
  expect(handlers.onCollect).toHaveBeenCalledTimes(1);
});

it('after disablement keeps lookup available and disables an unknown collection retry', () => {
  render(
    <AccountPaymentReview
      session={session}
      operation={operation}
      pending={{ ...pending, stage: 'collecting' }}
      disabled
      {...handlers}
    />,
  );
  expect(screen.getByRole('button', { name: 'accountPayments.retry_original' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.check_result' }));
  expect(handlers.onCheck).toHaveBeenCalledTimes(1);
});

it('allows only a separately verified original collection replay after disablement', () => {
  render(
    <AccountPaymentReview
      session={session}
      operation={operation}
      pending={{ ...pending, stage: 'collecting' }}
      disabled
      recoveryCollectionEnabled
      {...handlers}
    />,
  );

  const retry = screen.getByRole('button', { name: 'accountPayments.retry_original' });
  expect(retry).toBeEnabled();
  expect(screen.queryByLabelText('cashier.cash_received')).not.toBeInTheDocument();
  fireEvent.click(retry);
  expect(handlers.onCollect).toHaveBeenCalledTimes(1);
});

it('allows owner-scoped no-money release after flag-off while keeping collection disabled', () => {
  render(
    <AccountPaymentReview
      session={session}
      operation={operation}
      pending={{ ...pending, stage: 'reserved' }}
      disabled
      recoveryReleaseEnabled
      {...handlers}
    />,
  );

  expect(screen.getByRole('button', { name: 'accountPayments.record_collection' })).toBeDisabled();
  const release = screen.getByRole('button', { name: 'accountPayments.release' });
  expect(release).toBeDisabled();
  fireEvent.click(screen.getByLabelText('accountPayments.no_money_collected'));
  expect(release).toBeEnabled();
  fireEvent.click(release);
  expect(handlers.onRelease).toHaveBeenCalledTimes(1);
  expect(handlers.onCollect).not.toHaveBeenCalled();
});

it('keeps release retry disabled when lookup reports a provider-pending state', () => {
  render(
    <AccountPaymentReview
      session={session}
      operation={{ ...operation, state: 'Processing' }}
      pending={{ ...pending, stage: 'releasing' }}
      disabled
      recoveryReleaseEnabled
      {...handlers}
    />,
  );

  expect(screen.getByRole('button', { name: 'accountPayments.retry_original' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.check_result' }));
  expect(handlers.onCheck).toHaveBeenCalledTimes(1);
  expect(handlers.onRelease).not.toHaveBeenCalled();
});
