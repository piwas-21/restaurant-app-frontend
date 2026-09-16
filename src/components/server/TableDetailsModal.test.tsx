import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TableDetailsModal from './TableDetailsModal';
import type { ServerTableDto } from '@/services/serverService';
import { singleKitchenBundleOrder, nestedBundleOrder } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

jest.mock('@/services/serverService', () => ({
  closeTable: jest.fn(),
  openTable: jest.fn(),
  releaseTable: jest.fn(),
}));

const table: ServerTableDto = {
  id: 'table-1',
  tableNumber: '4',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 0,
  positionY: 0,
  currentOrders: [],
  orderCount: 1,
  hasActiveOrders: true,
  status: 'occupied',
};

const renderModal = (
  orders = [singleKitchenBundleOrder()],
  options: { status?: ServerTableDto['status']; isStale?: boolean } = {},
) =>
  render(
    <TableDetailsModal
      table={{ ...table, status: options.status ?? table.status }}
      orders={orders}
      onClose={jest.fn()}
      onUpdateOrderStatus={jest.fn()}
      onTakeOrder={jest.fn()}
      onTableStatusChanged={jest.fn()}
      isStale={options.isStale ?? false}
    />,
  );

describe('TableDetailsModal — bundle components', () => {
  it('shows the components of a combo, exactly once each', () => {
    renderModal();

    expect(screen.getByText(/Mezze Combo/)).toBeInTheDocument();
    expect(screen.getByText(/Hummus/)).toBeInTheDocument();
    expect(screen.getByText(/Fattoush Salad/)).toBeInTheDocument();
  });

  it('reaches a component of a component', () => {
    renderModal([nestedBundleOrder()]);

    expect(screen.getByText(/Mezze Selection/)).toBeInTheDocument();
    expect(screen.getByText(/Hummus/)).toBeInTheDocument();
  });

  it('blocks close and release actions while the table snapshot is stale', () => {
    renderModal([], { status: 'reserved', isStale: true });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Data may be out of date. Refresh before closing or releasing the table.',
    );
    expect(screen.getByRole('button', { name: /Mark as Available/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Close Table/ })).toBeDisabled();
  });
});
