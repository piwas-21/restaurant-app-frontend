import { fireEvent, render, screen } from '@testing-library/react';
import CashierTicketActions from './CashierTicketActions';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import { exportKitchenItemsToPDF, exportOrderToPDF } from '@/utils/pdfExportUtils';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { getOrderAmendmentHistory } from '@/services/orderAmendmentsService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('./FocusOrderDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('./order-details/OrderDetailsNotesSection', () => ({ __esModule: true, default: () => null }));
jest.mock('@/utils/pdfExportUtils', () => ({ exportKitchenItemsToPDF: jest.fn(), exportOrderToPDF: jest.fn() }));
jest.mock('@/services/orderAmendmentsService', () => ({ getOrderAmendmentHistory: jest.fn() }));
jest.mock('@/hooks/orderTypes/useConfirmationFlowConfig', () => ({
  useConfirmationFlowConfig: () => ({ flowByType: null }),
  flowLookup: () => () => ({ flow: 'acknowledge' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getOrderAmendmentHistory as jest.Mock).mockResolvedValue([]);
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

it('shows amendment controls and history only when the tenant flag is enabled', async () => {
  const order = { ...marketplaceOrder(), type: 'Takeaway', externalOrder: null };
  render(
    <TenantFeaturesProvider features={{ orderAmendmentsV1: true }}>
      <CashierTicketActions order={order} />
    </TenantFeaturesProvider>,
  );

  expect(screen.getByRole('button', { name: 'orderAmendments.open' })).toBeInTheDocument();
  expect(await screen.findByText('0')).toBeInTheDocument();
  expect(getOrderAmendmentHistory).toHaveBeenCalledWith(order.id);
  expect(screen.getByText('orderAmendments.history_title')).toBeInTheDocument();
});
