import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import type { PendingTableGuestRound, TableGuestAccountDto, TableGuestVisitIdentity } from '@/types/tableGuestVisit';

const TEST_VISIT_LIFETIME_MS = 60_000;

export interface TableGuestVisitHarnessOptions {
  readonly tableGuestVisitsV1?: boolean;
  readonly readPublicTableGuestFeature?: boolean;
}

export function createTableGuestVisitIdentity(
  overrides: Partial<TableGuestVisitIdentity> = {},
): TableGuestVisitIdentity {
  return {
    serviceSessionId: 'visit-id',
    participantToken: 'x'.repeat(40),
    expiresAt: new Date(Date.now() + TEST_VISIT_LIFETIME_MS).toISOString(),
    ...overrides,
  };
}

export function createPendingTableGuestRound(overrides: Partial<PendingTableGuestRound> = {}): PendingTableGuestRound {
  return {
    serviceSessionId: 'visit-id',
    operationId: 'operation-id',
    expectedAccountRevision: 3,
    expectedBasketFingerprint: 'B'.repeat(64),
    ...overrides,
  };
}

export function createTableGuestAccount(overrides: Partial<TableGuestAccountDto> = {}): TableGuestAccountDto {
  return {
    serviceSessionId: 'visit-id',
    tableLabel: '12',
    currency: 'CHF',
    accountRevision: 3,
    subTotal: 0,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 0,
    totalPaid: 0,
    remaining: 0,
    credit: 0,
    orders: [],
    items: [],
    ...overrides,
  };
}

export function renderWithTableGuestVisit(child: ReactElement, options: TableGuestVisitHarnessOptions = {}) {
  const features =
    options.tableGuestVisitsV1 === undefined ? undefined : { tableGuestVisitsV1: options.tableGuestVisitsV1 };

  return render(
    <I18nextProvider i18n={i18n}>
      <TableGuestFeatureProvider features={features} readPublicTableGuestFeature={options.readPublicTableGuestFeature}>
        <TableGuestVisitProvider>{child}</TableGuestVisitProvider>
      </TableGuestFeatureProvider>
    </I18nextProvider>,
  );
}
