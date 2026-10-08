import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { getServerOrderById } from '@/services/server/orders';
import { getOrderAmendmentHistory } from '@/services/orderAmendmentsService';
import type { OrderDto } from '@/types/order';
import ServerOrderDetailWorkspace from './ServerOrderDetailWorkspace';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/components/design-system/StaffWorkspaceShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('@/components/design-system/OrderStatusBadge', () => ({
  __esModule: true,
  default: ({ status }: { status: string }) => <span>{status}</span>,
}));
jest.mock('@/components/TenantLink', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('@/components/order/MarketplaceOrderSource', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/order/OrderLineSummary', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/order-amendments/OrderAmendmentEntryButton', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockOrderAmendmentEntryButton({ order, onCommitted }: { order: OrderDto; onCommitted?: () => void }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [committed, setCommitted] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>
          Amend {order.id}
        </button>
        {isOpen && (
          <section role="dialog" aria-label="Amendment">
            <button
              type="button"
              onClick={() => {
                setCommitted(true);
                onCommitted?.();
              }}
            >
              Commit amendment
            </button>
            {committed && <output>Amendment committed · operation</output>}
          </section>
        )}
      </>
    );
  }
  return {
    __esModule: true,
    default: MockOrderAmendmentEntryButton,
  };
});
jest.mock('@/services/server/orders', () => ({ getServerOrderById: jest.fn() }));
jest.mock('@/services/orderAmendmentsService', () => ({ getOrderAmendmentHistory: jest.fn() }));

const mockGetOrder = getServerOrderById as jest.Mock;
const mockGetHistory = getOrderAmendmentHistory as jest.Mock;
const order = (id: string, orderNumber: string): OrderDto =>
  ({
    id,
    orderNumber,
    type: 'DineIn',
    tableId: 'table-1',
    tableLabel: 'T1',
    serviceSessionId: `visit-${id}`,
    currency: 'CHF',
    total: 18,
    version: 3,
    status: 'Preparing',
    paymentStatus: 'Pending',
    customerName: 'Guest',
    items: [],
  }) as unknown as OrderDto;

describe('ServerOrderDetailWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHistory.mockResolvedValue([]);
  });

  it('does not expose the previous order while the next exact order ID is loading', async () => {
    mockGetOrder.mockResolvedValueOnce(order('order-1', 'A-001'));
    const view = render(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: true }}>
        <ServerOrderDetailWorkspace orderId="order-1" />
      </TenantFeaturesProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'A-001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amend order-1' })).toBeInTheDocument();
    await waitFor(() => expect(mockGetHistory).toHaveBeenCalledWith('order-1'));

    let resolveNext!: (value: OrderDto) => void;
    mockGetOrder.mockImplementationOnce(
      () =>
        new Promise<OrderDto>((resolve) => {
          resolveNext = resolve;
        }),
    );
    view.rerender(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: true }}>
        <ServerOrderDetailWorkspace orderId="order-2" />
      </TenantFeaturesProvider>,
    );

    expect(screen.queryByRole('heading', { name: 'A-001' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Amend order-1' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading orders…');

    await act(async () => resolveNext(order('order-2', 'A-002')));
    expect(await screen.findByRole('heading', { name: 'A-002' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amend order-2' })).toBeInTheDocument();
  });

  it('keeps the existing authenticated detail read available for flag-off recovery', async () => {
    mockGetOrder.mockResolvedValueOnce(order('order-3', 'A-003'));

    render(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: false }}>
        <ServerOrderDetailWorkspace orderId="order-3" />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByText('Order amendments are not enabled for this restaurant.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'A-003' })).toBeInTheDocument();
    await waitFor(() => expect(mockGetOrder).toHaveBeenCalledWith('order-3'));
    expect(mockGetHistory).not.toHaveBeenCalled();
  });

  it('keeps a committed amendment visible while refreshing the same order', async () => {
    mockGetOrder.mockResolvedValueOnce(order('order-4', 'A-004'));
    const view = render(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: true }}>
        <ServerOrderDetailWorkspace orderId="order-4" />
      </TenantFeaturesProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'A-004' })).toBeInTheDocument();

    let resolveRefresh!: (value: OrderDto) => void;
    mockGetOrder.mockImplementationOnce(
      () =>
        new Promise<OrderDto>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Amend order-4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Commit amendment' }));

    const dialog = screen.getByRole('dialog', { name: 'Amendment' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('Amendment committed');
    expect(screen.getByRole('heading', { name: 'A-004' })).toBeInTheDocument();
    expect(screen.getByText('Loading orders…')).toBeInTheDocument();

    await act(async () => resolveRefresh(order('order-4', 'A-004')));
    expect(screen.getByRole('dialog', { name: 'Amendment' })).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('Amendment committed');

    view.unmount();
  });
});
