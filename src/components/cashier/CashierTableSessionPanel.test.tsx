import { fireEvent, render, screen } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import CashierTableSessionPanel from './CashierTableSessionPanel';
import type { ComponentProps } from 'react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { loadAccountPaymentCollection } from './accountPaymentCollectionLoader';
import { loadAccountPaymentLocale } from '@/services/accountPaymentLocaleService';

jest.mock('@/components/AuthContext', () => ({
  useOptionalAuth: () => ({ user: { userId: '3b241101-e2bb-4255-8caf-4136c566a962' }, isLoading: false }),
}));

jest.mock('@/services/accountPaymentLocaleService', () => ({
  loadAccountPaymentLocale: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./accountPaymentCollectionLoader', () => ({
  loadAccountPaymentCollection: jest.fn(() =>
    Promise.resolve({
      default: ({
        enabled,
        disabled,
        recoveryEnabled,
      }: {
        enabled: boolean;
        disabled: boolean;
        recoveryEnabled: boolean;
      }) => (
        <output data-testid="account-payment-collection">
          {`${String(enabled)}:${String(disabled)}:${String(recoveryEnabled)}`}
        </output>
      ),
    }),
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown> | string) => {
      if (typeof values !== 'object' || !values) return key;
      return key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? `{{${name}}}`));
    },
    i18n: { language: 'en', resolvedLanguage: 'en', addResourceBundle: jest.fn() },
  }),
}));

const session = {
  serviceSessionId: 'session-1',
  tableId: 'table-stable-7',
  tableNumber: 7,
  tableLabel: '7',
  currency: 'CHF',
  status: 'Open',
  version: 1,
  openedAt: '2026-09-21T09:00:00Z',
  closedAt: null,
  roundCount: 1,
  ageMinutes: 60,
  outstanding: 20,
  hasUnassignedActiveOrders: true,
  bill: {
    tableId: 'table-stable-7',
    tableNumber: 7,
    tableLabel: '7',
    serviceSessionId: 'session-1',
    serviceSessionVersion: 1,
    currency: 'CHF',
    generatedAt: '2026-09-21T10:00:00Z',
    rounds: [],
    orders: [],
    orderCount: 0,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remaining: 20,
    isAmbiguous: false,
  },
} as TableServiceSessionDto;

function renderPanel(
  current: TableServiceSessionDto,
  overrides: Partial<ComponentProps<typeof CashierTableSessionPanel>> = {},
  features: { tableAccountV1?: boolean; tableGuestVisitsV1?: boolean; tableAccountPaymentsV1?: boolean } = {},
) {
  return render(
    <TenantFeaturesProvider
      features={{
        serverWorkspaceV2: false,
        tableAccountV1: features.tableAccountV1 ?? false,
        tableGuestVisitsV1: features.tableGuestVisitsV1 ?? false,
        tableAccountPaymentsV1: features.tableAccountPaymentsV1 ?? false,
      }}
    >
      <CashierTableSessionPanel
        session={current}
        error={null}
        isMutating={false}
        isStale={false}
        pendingOperation={null}
        onBack={jest.fn()}
        onRefresh={jest.fn()}
        onSubmitPayment={jest.fn()}
        onCloseSession={jest.fn()}
        onReconcilePendingOperation={jest.fn()}
        {...overrides}
      />
    </TenantFeaturesProvider>,
  );
}

describe('CashierTableSessionPanel', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.mocked(loadAccountPaymentCollection).mockClear();
    jest.mocked(loadAccountPaymentLocale).mockClear();
  });

  it('shows guest-code issuance for an open visit when the tenant feature is enabled', async () => {
    renderPanel({ ...session, hasUnassignedActiveOrders: false }, {}, { tableGuestVisitsV1: true });

    expect(await screen.findByText('table_guest_staff_code_title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'table_guest_staff_code_action' })).toBeEnabled();
  });

  it('pins a numbered table link to the selected open visit', () => {
    renderPanel({ ...session, hasUnassignedActiveOrders: false });

    expect(screen.getByRole('link', { name: 'cashier.tables.add_round' })).toHaveAttribute(
      'href',
      '/cashier/new?channel=DineIn&table=7&tableId=table-stable-7&serviceSessionId=session-1',
    );
  });

  it('links an alphanumeric table visit to cashier New Sale using stable identities', () => {
    renderPanel({
      ...session,
      tableId: 'outdoor-11a',
      tableNumber: null,
      tableLabel: '11a',
      hasUnassignedActiveOrders: false,
    });

    expect(screen.getByRole('link', { name: 'cashier.tables.add_round' })).toHaveAttribute(
      'href',
      '/cashier/new?channel=DineIn&table=11a&tableId=outdoor-11a&serviceSessionId=session-1',
    );
  });

  it('keeps Add Round pinned to a legacy visit that has no stable table ID', () => {
    renderPanel({
      ...session,
      tableId: undefined,
      hasUnassignedActiveOrders: false,
      bill: { ...session.bill, tableId: undefined },
    });

    expect(screen.getByRole('link', { name: 'cashier.tables.add_round' })).toHaveAttribute(
      'href',
      '/cashier/new?channel=DineIn&table=7&serviceSessionId=session-1',
    );
    expect(screen.queryByText('cashier.tables.add_round_identity_unavailable')).not.toBeInTheDocument();
  });

  it('requires a visit identity before linking Add Round', () => {
    renderPanel({
      ...session,
      serviceSessionId: '',
      hasUnassignedActiveOrders: false,
    });

    expect(screen.queryByRole('link', { name: 'cashier.tables.add_round' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cashier.tables.add_round' })).toBeDisabled();
    const identityNotice = screen.getByText('cashier.tables.add_round_identity_unavailable').closest('output');
    expect(identityNotice).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps Add Round disabled when the selected detail belongs to a closed prior visit', () => {
    renderPanel({
      ...session,
      serviceSessionId: 'closed-prior-visit',
      status: 'Closed',
      hasUnassignedActiveOrders: false,
    });

    expect(screen.queryByRole('link', { name: 'cashier.tables.add_round' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cashier.tables.add_round' })).toBeDisabled();
  });

  it('resolves legacy orders through the repair action instead of opening New Sale', () => {
    const resolve = jest.fn();
    renderPanel(session, { hasLegacyConflict: true, onResolveLegacyOrders: resolve });

    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.resolve_legacy_orders' }));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'cashier.tables.resolve_legacy_orders' })).not.toBeInTheDocument();
  });

  it('switches to the account tabs only when the tenant presentation flag is enabled', () => {
    renderPanel({ ...session, hasUnassignedActiveOrders: false }, {}, { tableAccountV1: true });

    expect(screen.getByRole('heading', { name: 'cashier.tables.account' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'cashier.tables.account_items' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'cashier.tables.account_payments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'cashier.tables.account_activity' })).toBeInTheDocument();
  });

  it('replaces cashier tender entry with lazy account collection when enabled', async () => {
    renderPanel({ ...session, hasUnassignedActiveOrders: false }, {}, { tableAccountPaymentsV1: true });

    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('true:false:true');
    expect(loadAccountPaymentCollection).toHaveBeenCalledTimes(1);
    expect(loadAccountPaymentLocale).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'cashier.tables.payment_title' })).not.toBeInTheDocument();
  });

  it('keeps owner recovery available when the server disables new collection', async () => {
    renderPanel(
      { ...session, canCollect: false, hasUnassignedActiveOrders: false },
      {},
      { tableAccountPaymentsV1: true },
    );

    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('true:true:true');
  });
});
