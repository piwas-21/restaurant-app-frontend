import { fireEvent, render, screen } from '@testing-library/react';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import CashierTableEmptyState from './CashierTableEmptyState';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown> | string) => {
      if (typeof values !== 'object' || !values) return key;
      return key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? `{{${name}}}`));
    },
  }),
}));
jest.mock('@/components/table-service/TableOccupancyRecoveryAction', () => ({
  __esModule: true,
  default: ({ tableId, enabled }: { tableId: string; enabled: boolean }) => (
    <output data-testid="recovery-action">{`${tableId}:${String(enabled)}`}</output>
  ),
}));

const entry: CashierTableEntry = {
  table: {
    id: 'table-stable-7',
    tableNumber: '7A',
    maxGuests: 4,
    isActive: true,
    isOutdoor: false,
    positionX: 1,
    positionY: 1,
    activeOrderCount: 1,
  },
  session: null,
  status: 'legacy',
};

describe('CashierTableEmptyState', () => {
  it('offers repair for a legacy-only table using an explicit resolve action', () => {
    const resolve = jest.fn();
    render(
      <CashierTableEmptyState
        entry={entry}
        isOpening={false}
        onBack={jest.fn()}
        onOpenSession={jest.fn()}
        onResolveLegacyOrders={resolve}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.resolve_legacy_orders' }));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: /sale/i })).not.toBeInTheDocument();
  });

  it('routes clearing a legacy occupancy through audited recovery instead of the old clear endpoint', () => {
    render(
      <CashierTableEmptyState
        entry={entry}
        isOpening={false}
        onBack={jest.fn()}
        onOpenSession={jest.fn()}
        recoveryEnabled
        onRecoveryComplete={jest.fn(async () => undefined)}
      />,
    );

    expect(screen.getByTestId('recovery-action')).toHaveTextContent('table-stable-7:true');
    expect(screen.queryByRole('button', { name: 'cashier.tables.clear_and_release' })).not.toBeInTheDocument();
  });

  it('locks open and resolve actions while recovery readback is unresolved', () => {
    const onOpenSession = jest.fn();
    const onResolveLegacyOrders = jest.fn();
    render(
      <CashierTableEmptyState
        entry={entry}
        isOpening={false}
        recoveryOperationPending
        onBack={jest.fn()}
        onOpenSession={onOpenSession}
        onResolveLegacyOrders={onResolveLegacyOrders}
      />,
    );

    expect(screen.getByRole('button', { name: 'cashier.tables.back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'cashier.tables.resolve_legacy_orders' })).toBeDisabled();
    expect(onOpenSession).not.toHaveBeenCalled();
    expect(onResolveLegacyOrders).not.toHaveBeenCalled();
  });
});
