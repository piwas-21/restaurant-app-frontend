import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import type { TableDto } from '@/types/reservation';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import CashierTableList from './CashierTableList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${Object.values(options).join(',')}` : key,
    i18n: { language: 'en' },
  }),
}));

const table: TableDto = {
  id: 'table-1',
  tableNumber: '01',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 1,
  positionY: 1,
};

const session: TableServiceSessionDto = {
  serviceSessionId: 'session-1',
  tableNumber: 1,
  currency: 'EUR',
  status: 'Open',
  version: 2,
  openedAt: '2026-09-12T18:00:00Z',
  closedAt: null,
  roundCount: 2,
  ageMinutes: 10,
  outstanding: 20,
  bill: {
    tableNumber: 1,
    serviceSessionId: 'session-1',
    serviceSessionVersion: 2,
    currency: 'EUR',
    generatedAt: '2026-09-12T18:00:00Z',
    orders: [],
    orderCount: 0,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remaining: 20,
  },
};

const entry: CashierTableEntry = { table, session, status: 'occupied' };

describe('CashierTableList', () => {
  it('normalizes table numbers for selection and keeps metadata separators decorative', () => {
    const { container } = render(
      <CashierTableList entries={[entry]} selectedTableNumber="1" onSelectTable={jest.fn()} />,
    );

    const card = screen.getByRole('button', { name: /cashier\.tables\.select_table/ });
    expect(card).toHaveAttribute('aria-pressed', 'true');

    const separators = Array.from(container.querySelectorAll('span[aria-hidden="true"]')).filter(
      (node) => node.textContent?.trim() === '·',
    );
    expect(separators).toHaveLength(2);
    separators.forEach((separator) => expect(separator).toHaveAttribute('aria-hidden', 'true'));
  });

  it('shows the canonical payment-requested status for a server handoff', () => {
    const requestedEntry: CashierTableEntry = {
      ...entry,
      session: { ...session, hasPendingPaymentHandoff: true },
    };

    render(<CashierTableList entries={[requestedEntry]} selectedTableNumber={null} onSelectTable={jest.fn()} />);

    expect(screen.getByText('cashier.tables.payment_requested')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAccessibleName(/cashier\.tables\.payment_requested/);
  });
});

it('renders a label-only visit under its configured label and passes plural counts', () => {
  const labelOnlySession: TableServiceSessionDto = {
    ...session,
    serviceSessionId: 'session-tqa',
    tableNumber: null,
    tableLabel: 'T-QA',
  };
  const labelEntry: CashierTableEntry = {
    table: { ...table, id: 'table-tqa', tableNumber: '' },
    session: labelOnlySession,
    status: 'occupied',
  };
  render(<CashierTableList entries={[labelEntry]} selectedTableNumber={null} onSelectTable={jest.fn()} />);

  expect(screen.getByText('T-QA')).toBeInTheDocument();
  expect(screen.queryByText(/Table null/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /cashier\.tables\.select_table:T-QA/ })).toBeInTheDocument();
  // The counted sentences go through the count option so i18next resolves the plural family.
  expect(screen.getByText('cashier.tables.capacity:4')).toBeInTheDocument();
  expect(screen.getByText('cashier.tables.rounds:2')).toBeInTheDocument();
});
