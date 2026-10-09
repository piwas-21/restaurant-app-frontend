import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GuestAccountPaymentContributionForm from './GuestAccountPaymentContributionForm';
import type { GuestPaymentQuoteChoice } from '@/hooks/tableGuest/useGuestPaymentContributionActions';
import type { AccountPaymentAllocation } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount, GuestPaymentEqualShareSummary } from '@/types/guestAccountPayments';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const orderId = '10000000-0000-4000-8000-000000000001';
const itemId = '20000000-0000-4000-8000-000000000001';
const allocations: AccountPaymentAllocation[] = [
  { orderId, orderItemId: itemId, startOrdinal: 1, unitCount: 3, minorPerUnit: 100, amountMinor: 300 },
];
const account: GuestAccountPaymentAccount = {
  serviceSessionId: '30000000-0000-4000-8000-000000000001',
  status: 'Open',
  accountRevision: 2,
  currency: 'CHF',
  outstandingMinor: 1000,
  reservedMinor: 0,
  availableMinor: 1000,
  capturedAccountPaymentMinor: 0,
  outstandingAllocations: allocations,
  availableAllocations: allocations,
  activeEqualSharePlan: null,
  activeAttempts: [],
  limits: {
    maximumSelectedUnits: 5,
    maximumEqualShares: 8,
    online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 1000 },
  },
};
const plan: GuestPaymentEqualShareSummary = {
  planId: '40000000-0000-4000-8000-000000000001',
  accountRevision: 2,
  totalMinor: 1000,
  shareCount: 2,
  currency: 'CHF',
  isOwnPlan: false,
  slots: [
    { ordinal: 1, amountMinor: 500, claimState: null, isAvailable: true },
    { ordinal: 2, amountMinor: 500, claimState: null, isAvailable: true },
  ],
  scope: allocations,
};

describe('GuestAccountPaymentContributionForm', () => {
  it('submits a schema-parsed exact amount through the real form', async () => {
    const onReview = jest.fn().mockResolvedValue(true);
    renderForm(onReview);

    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_review' }));

    await waitFor(() =>
      expect(onReview).toHaveBeenCalledWith({ mode: 'Amount', paymentMethod: 'OnlinePayment', amountMinor: 100 }),
    );
  });

  it('shows a localized validation error and does not quote a non-positive amount', async () => {
    const onReview = jest.fn().mockResolvedValue(true);
    renderForm(onReview);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '0' } });

    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_review' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('table_guest_payment_invalid_amount');
    expect(onReview).not.toHaveBeenCalled();
  });

  it('does not review a valid contribution when the form is disabled, even on direct submit', async () => {
    const onReview = jest.fn().mockResolvedValue(true);
    renderForm(onReview, null, true);
    const form = screen.getByRole('button', { name: 'table_guest_payment_review' }).closest('form');
    if (!form) throw new Error('Contribution form was not rendered');

    fireEvent.submit(form);

    await waitFor(() => expect(onReview).not.toHaveBeenCalled());
  });

  it('submits selected available item units from the schema-backed form state', async () => {
    const onReview = jest.fn().mockResolvedValue(true);
    renderForm(onReview);
    fireEvent.click(screen.getByRole('radio', { name: 'table_guest_payment_items' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_review' }));

    await waitFor(() =>
      expect(onReview).toHaveBeenCalledWith({
        mode: 'Items',
        paymentMethod: 'OnlinePayment',
        selectedUnits: [
          { orderId, orderItemId: itemId, ordinal: 1 },
          { orderId, orderItemId: itemId, ordinal: 2 },
        ],
      }),
    );
  });

  it('submits an available equal-share choice from the schema-backed form state', async () => {
    const onReview = jest.fn().mockResolvedValue(true);
    renderForm(onReview, plan);
    fireEvent.click(screen.getByRole('radio', { name: 'table_guest_payment_equal' }));
    fireEvent.click(screen.getAllByRole('radio', { name: 'table_guest_payment_share' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'table_guest_payment_review' }));

    await waitFor(() =>
      expect(onReview).toHaveBeenCalledWith({
        mode: 'Equal',
        paymentMethod: 'OnlinePayment',
        equalSharePlanId: plan.planId,
        equalShareOrdinal: 1,
      }),
    );
  });
});

function renderForm(
  onReview: (quote: GuestPaymentQuoteChoice) => Promise<boolean>,
  activePlan: GuestPaymentEqualShareSummary | null = null,
  disabled = false,
) {
  return render(
    <GuestAccountPaymentContributionForm
      account={account}
      tableAccount={null}
      activePlan={activePlan}
      disabled={disabled}
      onReview={onReview}
      onCreatePlan={jest.fn().mockResolvedValue(true)}
    />,
  );
}
