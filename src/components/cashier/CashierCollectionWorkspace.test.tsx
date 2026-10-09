import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { CashierCollectionState } from '@/hooks/cashier/useCashierCollection';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import CashierCollectionWorkspace from './CashierCollectionWorkspace';

const mockOrder = { ...marketplaceOrder(), remainingAmount: 11.47 };
const mockCollectionState = {
  order: mockOrder,
  isLoading: false,
  isMutating: false,
  isCheckingPayment: false,
  error: null,
  pendingPayment: null,
  recoveryError: null,
  recoveryOrderId: null,
  recoveredPayment: null,
  outcomeOrderId: mockOrder.id,
  refresh: jest.fn(),
  submitPayment: jest.fn(),
  retryPendingPayment: jest.fn(),
} satisfies CashierCollectionState;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string; defaultValue?: string }) => {
      if (key === 'marketplaceStaff.collection_settlement_body') {
        return `Payment is handled through ${options?.provider}. Do not collect payment here.`;
      }
      return options?.defaultValue ?? key;
    },
  }),
}));
jest.mock('@/hooks/cashier/useCashierCollection', () => ({
  useCashierCollection: () => mockCollectionState,
}));
jest.mock('@/hooks/cashier/useCashierOrderRoute', () => ({
  useCashierOrderRoute: () => ({
    selectedOrderId: mockOrder.id,
    navigateToOrder: jest.fn(),
    navigateToOrders: jest.fn(),
  }),
}));
jest.mock('./CashierWorkspaceShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('./CashierCollectionPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="cashier-collection-form" />,
}));
jest.mock('@/utils/pdfExportUtils', () => ({ exportOrderToPDF: jest.fn() }));
jest.mock('@/components/TenantLink', () => ({ __esModule: true, default: 'a' }));

it('shows provider settlement guidance on a direct marketplace collection route, never a local due balance', () => {
  render(<CashierCollectionWorkspace />);

  expect(screen.getByRole('heading', { name: 'marketplaceStaff.collection_settlement_title' })).toBeInTheDocument();
  expect(screen.getByText('Payment is handled through Uber Eats. Do not collect payment here.')).toBeInTheDocument();
  expect(screen.queryByText('cashier.collection.no_due')).not.toBeInTheDocument();
  expect(screen.queryByText(/11\.47/)).not.toBeInTheDocument();
  expect(screen.queryByTestId('cashier-collection-form')).not.toBeInTheDocument();
});
