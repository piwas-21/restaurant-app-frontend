import { render, screen, within } from '@testing-library/react';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import AccountPaymentCashEvidence from './AccountPaymentCashEvidence';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const operation: AccountPaymentOperation = {
  operationId: '11111111-1111-4111-8111-111111111111',
  serviceSessionId: '22222222-2222-4222-8222-222222222222',
  state: 'Reserved',
  version: 2,
  expectedAccountRevision: 1,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 333,
  currency: 'CHF',
  quoteExpiresAt: '2026-10-03T12:02:00Z',
  reservedAt: '2026-10-03T12:01:00Z',
  reservationExpiresAt: '2026-10-03T12:06:00Z',
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [],
  cashSettlement: {
    policyVersion: 'chf-cash-5-rappen-v1',
    currency: 'CHF',
    paymentMethod: 'Cash',
    exactAmountMinor: 333,
    adjustmentMinor: 2,
    dueAmountMinor: 335,
  },
};

function displayedAmount(label: string): HTMLElement {
  const term = screen.getByText(label);
  const row = term.parentElement;
  if (!row) throw new Error('Amount label has no row');
  return within(row).getByRole('definition');
}

it('shows the exact account charge and rounded cash due as separate amounts', () => {
  render(<AccountPaymentCashEvidence operation={operation} />);
  expect(displayedAmount('accountPayments.cash.exact_charge')).toHaveTextContent('CHF 3.33');
  expect(displayedAmount('accountPayments.cash.rounding_adjustment')).toHaveTextContent('CHF 0.02');
  expect(displayedAmount('accountPayments.cash.due')).toHaveTextContent('CHF 3.35');
  expect(screen.getByText('accountPayments.cash.rounding_note')).toBeVisible();
  expect(screen.queryByText('accountPayments.cash.receipt')).not.toBeInTheDocument();
});

it('shows a negative adjustment without changing the exact account charge', () => {
  render(
    <AccountPaymentCashEvidence
      operation={{
        ...operation,
        amountMinor: 332,
        cashSettlement: {
          ...operation.cashSettlement!,
          exactAmountMinor: 332,
          adjustmentMinor: -2,
          dueAmountMinor: 330,
        },
      }}
    />,
  );
  expect(displayedAmount('accountPayments.cash.exact_charge')).toHaveTextContent('CHF 3.32');
  expect(displayedAmount('accountPayments.cash.rounding_adjustment')).toHaveTextContent('−CHF 0.02');
  expect(displayedAmount('accountPayments.cash.due')).toHaveTextContent('CHF 3.30');
});

it('shows only verified received cash and change from the captured receipt', () => {
  render(
    <AccountPaymentCashEvidence
      operation={{
        ...operation,
        state: 'Captured',
        cashReceipt: {
          policyVersion: 'chf-cash-5-rappen-v1',
          currency: 'CHF',
          exactAmountMinor: 333,
          adjustmentMinor: 2,
          dueAmountMinor: 335,
          receivedMinor: 500,
          changeMinor: 165,
          capturedAt: '2026-10-03T12:03:00Z',
        },
      }}
    />,
  );
  expect(screen.getByText('accountPayments.cash.receipt')).toBeVisible();
  expect(displayedAmount('cashier.cash_received')).toHaveTextContent('CHF 5.00');
  expect(displayedAmount('cashier.cash_change')).toHaveTextContent('CHF 1.65');
});

it('labels legacy captured cash as unattested and does not invent received cash or change', () => {
  render(<AccountPaymentCashEvidence operation={{ ...operation, state: 'Captured', cashSettlement: null }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.cash.legacy_unattested');
  expect(screen.queryByText('cashier.cash_received')).not.toBeInTheDocument();
  expect(screen.queryByText('cashier.cash_change')).not.toBeInTheDocument();
});

it.each(['Cash', 'CreditCard'] as const)('does not render invalid or inapplicable receipt details for %s', (method) => {
  const { container } = render(
    <AccountPaymentCashEvidence
      operation={{
        ...operation,
        paymentMethod: method,
        cashSettlement: { ...operation.cashSettlement!, currency: 'EUR' },
      }}
    />,
  );
  if (method === 'Cash')
    expect(screen.getByRole('alert')).toHaveTextContent('accountPayments.cash.evidence_unavailable');
  else expect(container).toBeEmptyDOMElement();
  expect(screen.queryByText('accountPayments.cash.due')).not.toBeInTheDocument();
});
