import { fireEvent, render, screen } from '@testing-library/react';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import CashierTableMap from './CashierTableMap';

jest.mock('@/hooks/floorPlan/useFloorPlanDocument', () => ({
  useFloorPlanDocument: () => ({
    status: 'ready',
    document: {
      tables: [
        { id: 'one', tableNumber: '01', isActive: true },
        { id: 'two', tableNumber: '02', isActive: true },
      ],
    },
  }),
}));
jest.mock('@/components/floor-plan/FloorPlanScene', () => ({
  __esModule: true,
  default: ({
    document,
    tableStates,
    onSelectTable,
  }: {
    document: { tables: { id: string; tableNumber: string }[] };
    tableStates: Record<string, string>;
    onSelectTable: (id: string) => void;
  }) => (
    <>
      {document.tables.map((table) => (
        <button key={table.id} data-state={tableStates[table.id]} onClick={() => onSelectTable(table.id)}>
          {table.tableNumber}
        </button>
      ))}
    </>
  ),
}));

it('filters geometry without changing occupied states or the visit identity', () => {
  const entries = [
    { table: { id: 'one', tableNumber: '01' }, status: 'available', session: null },
    { table: { id: 'two', tableNumber: '02' }, status: 'occupied', session: { serviceSessionId: 'visit-two' } },
  ] as unknown as CashierTableEntry[];
  const select = jest.fn();
  const view = render(
    <CashierTableMap entries={entries} searchQuery="01" selectedTableNumber={null} onSelectTable={select} />,
  );
  expect(screen.queryByRole('button', { name: '02' })).not.toBeInTheDocument();
  view.rerender(
    <CashierTableMap entries={entries} searchQuery="02" selectedTableNumber={null} onSelectTable={select} />,
  );
  const occupied = screen.getByRole('button', { name: '02' });
  expect(occupied).toHaveAttribute('data-state', 'occupied');
  fireEvent.click(occupied);
  expect(select).toHaveBeenCalledWith('02', 'visit-two');
});
