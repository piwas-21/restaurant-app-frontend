import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { getServerAmendmentOrders } from '@/services/server/orders';
import type { OrderDto } from '@/types/order';
import type { PagedResult } from '@/types/order/common';
import ServerOrdersWorkspace from './ServerOrdersWorkspace';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
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
jest.mock('@/services/server/orders', () => ({ getServerAmendmentOrders: jest.fn() }));

const mockGetOrders = getServerAmendmentOrders as jest.Mock;
const nativeOrders = (['DineIn', 'Takeaway', 'Delivery'] as const).map(
  (type, index) =>
    ({
      id: `order-${index + 1}`,
      orderNumber: `A-00${index + 1}`,
      type,
      status: 'Ready',
      paymentStatus: 'Pending',
      total: 12,
      currency: 'CHF',
      items: [],
    }) as unknown as OrderDto,
);

function paged(items = nativeOrders): PagedResult<OrderDto> {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

describe('ServerOrdersWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrders.mockResolvedValue(paged());
  });

  it('keeps the authenticated order list available as read-only when amendments are disabled', async () => {
    render(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: false }}>
        <ServerOrdersWorkspace />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByText('Order amendments are not enabled for this restaurant.')).toBeInTheDocument();
    await waitFor(() => expect(mockGetOrders).toHaveBeenCalledWith('All', 1, 50, ''));
    expect(await screen.findByText('A-001')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Review order' })[0]).toHaveAttribute('href', '/server/orders/order-1');
  });

  it('lists every native order type for fresh detail review', async () => {
    render(
      <TenantFeaturesProvider features={{ orderAmendmentsV1: true }}>
        <ServerOrdersWorkspace />
      </TenantFeaturesProvider>,
    );

    await waitFor(() => expect(mockGetOrders).toHaveBeenCalledWith('All', 1, 50, ''));
    expect(await screen.findByText('A-001')).toBeInTheDocument();
    expect(screen.getByText('A-002')).toBeInTheDocument();
    expect(screen.getByText('A-003')).toBeInTheDocument();
    const reviewLinks = screen.getAllByRole('link', { name: 'Review order' });
    expect(reviewLinks).toHaveLength(3);
    expect(reviewLinks[0]).toHaveAttribute('href', '/server/orders/order-1');
  });
});
