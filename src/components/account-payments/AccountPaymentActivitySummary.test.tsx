import { render, screen } from '@testing-library/react';
import AccountPaymentActivitySummary from './AccountPaymentActivitySummary';
import type { AccountPaymentAttemptSummary } from '@/types/accountPaymentAccount';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const attempts: AccountPaymentAttemptSummary[] = [
  {
    operationId: 'private-own-operation-id',
    state: 'Reserved',
    version: 2,
    paymentMethod: 'Cash',
    amountMinor: 500,
    currency: 'EUR',
    reservationExpiresAt: '2026-10-03T10:00:00Z',
    equalSharePlanId: null,
    equalShareOrdinal: null,
    isOwnOperation: true,
  },
  {
    operationId: null,
    state: 'Processing',
    version: 4,
    paymentMethod: 'CreditCard',
    amountMinor: 1299,
    currency: 'EUR',
    reservationExpiresAt: null,
    equalSharePlanId: 'private-plan-id',
    equalShareOrdinal: 2,
    isOwnOperation: false,
  },
  {
    operationId: null,
    state: 'Processing',
    version: 1,
    paymentMethod: 'OnlinePayment',
    amountMinor: 1499,
    currency: 'EUR',
    reservationExpiresAt: null,
    equalSharePlanId: null,
    equalShareOrdinal: null,
    isOwnOperation: false,
  },
];

it('shows captured money and bounded attempt status using only the server ownership flag', () => {
  const { container } = render(
    <AccountPaymentActivitySummary capturedMinor={2450} attempts={attempts} currency="EUR" />,
  );

  expect(screen.getByText('accountPayments.captured')).toBeInTheDocument();
  expect(screen.getByText('€24.50')).toBeInTheDocument();
  expect(screen.getByText('accountPayments.active_attempts')).toBeInTheDocument();
  expect(screen.getByText('accountPayments.state.Reserved')).toBeInTheDocument();
  expect(screen.getAllByText('accountPayments.state.Processing')).toHaveLength(2);
  const rows = screen.getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('accountPayments.own_attempt');
  expect(rows[1]).toHaveTextContent('accountPayments.other_cashier');
  expect(rows[2]).toHaveTextContent('€14.99');
  expect(rows[2]).toHaveTextContent('accountPayments.method_guest_online');
  expect(rows[2]).not.toHaveTextContent('accountPayments.other_cashier');
  expect(rows[2]).not.toHaveTextContent('accountPayments.own_attempt');
  expect(container.textContent).not.toContain('private-own-operation-id');
  expect(container.textContent).not.toContain('private-plan-id');
});

it('keeps a representative backend guest-attempt projection free of actor and provider credentials', () => {
  // Mirrors AccountPaymentAttemptSummaryDto after the backend has removed guest/provider custody fields.
  const guestAttempt: AccountPaymentAttemptSummary = {
    operationId: null,
    state: 'Processing',
    version: 3,
    paymentMethod: 'OnlinePayment',
    amountMinor: 840,
    currency: 'CHF',
    reservationExpiresAt: null,
    equalSharePlanId: null,
    equalShareOrdinal: null,
    isOwnOperation: false,
  };
  const { container } = render(
    <AccountPaymentActivitySummary capturedMinor={0} attempts={[guestAttempt]} currency="CHF" />,
  );

  expect(screen.getByRole('listitem')).toHaveTextContent('accountPayments.method_guest_online');
  expect(container.textContent).not.toContain('accountPayments.other_cashier');
  expect(container.textContent).not.toContain('guest-participant-id');
  expect(container.textContent).not.toContain('provider-session-secret');
  expect(Object.keys(guestAttempt).sort()).toEqual(
    [
      'operationId',
      'state',
      'version',
      'paymentMethod',
      'amountMinor',
      'currency',
      'reservationExpiresAt',
      'equalSharePlanId',
      'equalShareOrdinal',
      'isOwnOperation',
    ].sort(),
  );
});

it('keeps the paid total visible when there are no active attempts', () => {
  render(<AccountPaymentActivitySummary capturedMinor={0} attempts={[]} currency="EUR" />);

  expect(screen.getByText('accountPayments.captured')).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});
