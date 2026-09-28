import { fireEvent, render, screen } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import CashierTableSessionPanel from './CashierTableSessionPanel';
import type { ComponentProps } from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown> | string) => {
      if (typeof values !== 'object' || !values) return key;
      return key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? `{{${name}}}`));
    },
    i18n: { language: 'en' },
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
) {
  return render(
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
    />,
  );
}

describe('CashierTableSessionPanel', () => {
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

  it('resolves legacy orders through the repair action instead of opening New Sale', () => {
    const resolve = jest.fn();
    renderPanel(session, { hasLegacyConflict: true, onResolveLegacyOrders: resolve });

    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.resolve_legacy_orders' }));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'cashier.tables.resolve_legacy_orders' })).not.toBeInTheDocument();
  });
});
