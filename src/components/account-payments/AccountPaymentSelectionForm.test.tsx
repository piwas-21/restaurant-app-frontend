import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountPaymentSelectionForm from './AccountPaymentSelectionForm';
import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import type { TableServiceSessionDto } from '@/types/order';

const translate = (key: string, values?: Record<string, unknown>) => (values ? `${key}:${String(values.number)}` : key);
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate, i18n: { language: 'en' } }) }));
const visit = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const account: AccountPaymentAccount = {
  serviceSessionId: visit,
  status: 'Open',
  accountRevision: 7,
  currency: 'EUR',
  outstandingMinor: 1029,
  reservedMinor: 1000,
  availableMinor: 29,
  capturedAccountPaymentMinor: 0,
  outstandingAllocations: [],
  availableAllocations: [
    { orderId, orderItemId: itemId, startOrdinal: 31, unitCount: 29, minorPerUnit: 1, amountMinor: 29 },
  ],
  activeEqualSharePlan: null,
  activeAttempts: [],
  limits: { maximumSelectedUnits: 5, maximumEqualShares: 20 },
};
const session = { serviceSessionId: visit, bill: { accountItems: [] } } as unknown as TableServiceSessionDto;
const onQuote = jest.fn(async () => undefined);
const onPlan = jest.fn(async () => undefined);
const renderForm = (paymentAccount = account) =>
  render(
    <AccountPaymentSelectionForm
      account={paymentAccount}
      session={session}
      disabled={false}
      onQuote={onQuote}
      onPlan={onPlan}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

it('reviews only the available amount and never includes money reserved by another payer', async () => {
  renderForm();
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.review' }));
  await waitFor(() => expect(onQuote).toHaveBeenCalledTimes(1));
  expect(onQuote).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'Full', expectedAccountRevision: 7, paymentMethod: 'Cash', tipMinor: 0 }),
  );
});

it('keeps guest OnlinePayment outside the staff quote methods', () => {
  renderForm();

  const method = screen.getByLabelText('cashier.payment_method');
  expect(method).toHaveValue('Cash');
  expect(method).toHaveDisplayValue('cashier.table_bill.method_cash');
  expect(screen.getByRole('option', { name: 'payment_card_at_restaurant' })).toHaveValue('CreditCard');
  expect(screen.queryByRole('option', { name: 'accountPayments.method_guest_online' })).not.toBeInTheDocument();
});

it('parses comma-decimal custom contributions exactly and rejects an amount beyond unreserved debt', async () => {
  renderForm();
  fireEvent.change(screen.getByLabelText('accountPayments.contribution'), { target: { value: 'Amount' } });
  fireEvent.change(screen.getByLabelText('accountPayments.amount'), { target: { value: '0,30' } });
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.review' }));
  expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.invalid_amount');
  expect(onQuote).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('accountPayments.amount'), { target: { value: '0,29' } });
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.review' }));
  await waitFor(() => expect(onQuote).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 29 })));
});

it('selects two remaining unit ordinals with the server limit instead of expanding the historical full quantity', async () => {
  renderForm();
  fireEvent.change(screen.getByLabelText('accountPayments.contribution'), { target: { value: 'Items' } });
  const quantity = screen.getByRole('spinbutton');
  expect(quantity).toHaveAttribute('max', '5');
  fireEvent.change(quantity, { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.review' }));
  await waitFor(() =>
    expect(onQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'Items',
        selectedUnits: [
          { orderId, orderItemId: itemId, ordinal: 31 },
          { orderId, orderItemId: itemId, ordinal: 32 },
        ],
      }),
    ),
  );
});

it('displays frozen equal shares with remainder and keeps a captured slot unavailable', async () => {
  const planId = '55555555-5555-4555-8555-555555555555';
  const equalAccount: AccountPaymentAccount = {
    ...account,
    availableMinor: 666,
    reservedMinor: 0,
    activeEqualSharePlan: {
      planId,
      accountRevision: 4,
      totalMinor: 1000,
      shareCount: 3,
      currency: 'EUR',
      isOwnPlan: false,
      isCustom: false,
      customAmountsMinor: null,
      scope: [],
      slots: [
        { ordinal: 1, amountMinor: 334, isAvailable: false, claimState: 'Captured' },
        { ordinal: 2, amountMinor: 333, isAvailable: true, claimState: null },
        { ordinal: 3, amountMinor: 333, isAvailable: true, claimState: null },
      ],
    },
  };
  renderForm(equalAccount);
  fireEvent.change(screen.getByLabelText('accountPayments.contribution'), { target: { value: 'Equal' } });
  expect(screen.getByRole('option', { name: /share_number:1/ })).toBeDisabled();
  expect(screen.getByRole('option', { name: /share_number:1/ })).toHaveTextContent('€3.34');
  expect(screen.getByRole('option', { name: /share_number:2/ })).toHaveTextContent('€3.33');
  fireEvent.change(screen.getByLabelText('accountPayments.choose_share'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.review' }));
  await waitFor(() =>
    expect(onQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'Equal',
        equalSharePlanId: planId,
        equalShareOrdinal: 2,
        expectedAccountRevision: 7,
      }),
    ),
  );
  expect(onPlan).not.toHaveBeenCalled();
});

it('records Full as a distinct payment flow and keeps its tip outside the account amount', async () => {
  renderForm();
  fireEvent.change(screen.getByLabelText('cashier.tables.payment_tip'), { target: { value: '1.23' } });
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.review' }));
  await waitFor(() =>
    expect(onQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'Full',
        tipMinor: 123,
      }),
    ),
  );
});

it('creates custom guest amounts only when the immutable plan exactly covers the available balance', async () => {
  renderForm();
  fireEvent.change(screen.getByLabelText('accountPayments.contribution'), { target: { value: 'CustomAmount' } });
  fireEvent.change(screen.getByLabelText('accountPayments.share_amount:1'), { target: { value: '0.15' } });
  fireEvent.change(screen.getByLabelText('accountPayments.share_amount:2'), { target: { value: '0.14' } });
  fireEvent.click(screen.getByRole('button', { name: 'accountPayments.create_plan' }));
  await waitFor(() =>
    expect(onPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        shareCount: 2,
        customAmountsMinor: [15, 14],
      }),
    ),
  );
});
