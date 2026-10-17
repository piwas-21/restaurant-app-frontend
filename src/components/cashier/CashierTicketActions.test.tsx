import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CashierTicketActions from './CashierTicketActions';
import type { OrderDto } from '@/types/order';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import { exportKitchenItemsToPDF, exportOrderToPDF } from '@/utils/pdfExportUtils';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { getOrderAmendmentHistory } from '@/services/orderAmendmentsService';
import { getOrderAmendmentEligibility } from '@/services/orderAmendmentEligibilityService';
import { updateOrderStatus } from '@/services/cashierService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('./FocusOrderDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('./order-details/OrderDetailsNotesSection', () => ({ __esModule: true, default: () => null }));
jest.mock('@/utils/pdfExportUtils', () => ({ exportKitchenItemsToPDF: jest.fn(), exportOrderToPDF: jest.fn() }));
jest.mock('@/services/orderAmendmentsService', () => ({ getOrderAmendmentHistory: jest.fn() }));
jest.mock('@/services/orderAmendmentEligibilityService', () => ({ getOrderAmendmentEligibility: jest.fn() }));
jest.mock('@/services/cashierService', () => ({
  ...jest.requireActual('@/services/cashierService'),
  updateOrderStatus: jest.fn(),
}));
jest.mock('@/hooks/accountPayments/useAccountPaymentActor', () => ({
  useAccountPaymentActor: () => ({
    actorId: '00000000-0000-4000-8000-000000000002',
    status: 'ready',
    retry: jest.fn(),
  }),
}));
jest.mock('@/hooks/orderTypes/useConfirmationFlowConfig', () => ({
  useConfirmationFlowConfig: () => ({ flowByType: null }),
  flowLookup: () => () => ({ flow: 'acknowledge' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getOrderAmendmentHistory as jest.Mock).mockResolvedValue([]);
  jest.mocked(updateOrderStatus).mockResolvedValue({} as never);
});

it('withholds ordinary approval and printing for a held Uber order, retaining notes and focus', () => {
  render(<CashierTicketActions order={marketplaceOrder()} />);
  expect(screen.queryByRole('button', { name: 'cashier.approve_order_action' })).not.toBeInTheDocument();
  const kitchen = screen.getByRole('button', { name: 'cashier.workspace.print_kitchen' });
  const bill = screen.getByRole('button', { name: 'cashier.workspace.print_bill' });
  expect(kitchen).toBeDisabled();
  expect(bill).toBeDisabled();
  fireEvent.click(kitchen);
  fireEvent.click(bill);
  expect(exportKitchenItemsToPDF).not.toHaveBeenCalled();
  expect(exportOrderToPDF).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'cashier.workspace.add_note' })).toBeEnabled();
  expect(screen.getByRole('button', { name: /cashier.mark_as_focus/ })).toBeEnabled();
});
it('permits a kitchen reprint only after explicit server permission', () => {
  const order = marketplaceOrder();
  order.isKitchenReleased = true;
  order.permittedActions = [{ action: 'PrintKitchen', allowed: true, requiresReason: false }];
  render(<CashierTicketActions order={order} />);
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.print_kitchen' }));
  expect(exportKitchenItemsToPDF).toHaveBeenCalledWith(order, 'GeneralKitchen', expect.any(Function));
  expect(screen.getByRole('button', { name: 'cashier.workspace.print_bill' })).toBeDisabled();
});
it('keeps ordinary approval and print controls available', () => {
  const order = { ...marketplaceOrder(), externalOrder: null };
  render(<CashierTicketActions order={order} />);
  expect(screen.getByRole('button', { name: 'cashier.approve_order_action' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'orderAmendments.open' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.print_bill' }));
  expect(exportOrderToPDF).toHaveBeenCalledWith(order, expect.any(Function));
});

it('offers prominent Quick Ready only with a fresh, server-permitted preparing order and refreshes after success', async () => {
  const order = {
    ...marketplaceOrder(),
    type: 'Takeaway',
    externalOrder: null,
    status: 'Preparing',
    permittedActions: [{ action: 'MarkReady', allowed: true, requiresReason: false }],
  };
  const onOrderChanged = jest.fn();
  render(<CashierTicketActions order={order} isOrderSnapshotFresh onOrderChanged={onOrderChanged} />);

  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.mark_ready' }));
  await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith(order.id, 'Ready', order.version));
  expect(onOrderChanged).toHaveBeenCalled();
});

it('shows permitted native status choices and applies the selected status', async () => {
  const order = {
    ...marketplaceOrder(),
    status: 'Confirmed',
    permittedActions: [
      { action: 'StartPreparing', targetStatus: 'Preparing', allowed: true, requiresReason: false },
      { action: 'MarkReady', targetStatus: 'Ready', allowed: true, requiresReason: false },
    ],
  } as OrderDto;
  render(<CashierTicketActions order={order} isOrderSnapshotFresh />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.set_status' }));

  await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith(order.id, 'Preparing', order.version));
});

it('keeps an approval-required handoff out of the direct status control', () => {
  const order = {
    ...marketplaceOrder(),
    type: 'Takeaway',
    externalOrder: null,
    status: 'Pending',
    permittedActions: [{ action: 'Accept', targetStatus: 'Confirmed', allowed: true, requiresReason: false }],
  } as OrderDto;
  render(<CashierTicketActions order={order} isOrderSnapshotFresh />);

  expect(screen.getByRole('button', { name: 'cashier.approve_order_action' })).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('withholds Quick Ready when the order snapshot is stale or the backend has not permitted it', () => {
  const order: OrderDto = { ...marketplaceOrder(), status: 'Preparing', permittedActions: [] };
  const { rerender } = render(<CashierTicketActions order={order} isOrderSnapshotFresh />);
  expect(screen.queryByRole('button', { name: 'cashier.workspace.mark_ready' })).not.toBeInTheDocument();

  order.permittedActions = [{ action: 'MarkReady', allowed: true, requiresReason: false }];
  rerender(<CashierTicketActions order={order} isOrderSnapshotFresh={false} />);
  expect(screen.queryByRole('button', { name: 'cashier.workspace.mark_ready' })).not.toBeInTheDocument();
});

it('shows amendment controls and history with the tenant flag and current server eligibility', async () => {
  const order = { ...marketplaceOrder(), type: 'Takeaway', externalOrder: null, version: 1 };
  jest.mocked(getOrderAmendmentEligibility).mockResolvedValue({
    orderId: order.id,
    orderVersion: 1,
    accountRevision: null,
    canCreateAmendment: true,
    reasonCode: null,
    amendmentMode: 'Native',
  });
  render(
    <TenantFeaturesProvider features={{ orderAmendmentsV1: true }}>
      <CashierTicketActions order={order} />
    </TenantFeaturesProvider>,
  );

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'orderAmendments.open' })).not.toHaveAttribute('aria-disabled'),
  );
  expect(getOrderAmendmentEligibility).toHaveBeenCalledWith(order.id);
  expect(await screen.findByText('0')).toBeInTheDocument();
  expect(getOrderAmendmentHistory).toHaveBeenCalledWith(order.id);
  expect(screen.getByText('orderAmendments.history_title')).toBeInTheDocument();
});
