import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import french from '@/locales/fr.json';
import { getServerAmendmentOrders, getServerOrderById } from '@/services/server/orders';
import type { OrderDto } from '@/types/order';
import ServerOrderDetailWorkspace from './ServerOrderDetailWorkspace';
import ServerOrdersWorkspace from './ServerOrdersWorkspace';

jest.mock('@/components/design-system/StaffWorkspaceShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('@/components/design-system/OrderStatusBadge', () => ({ __esModule: true, default: () => null }));
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
jest.mock('@/components/order-amendments/OrderAmendmentEntryButton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/order-amendments/OrderAmendmentHistorySection', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/services/server/orders', () => ({
  getServerAmendmentOrders: jest.fn(),
  getServerOrderById: jest.fn(),
}));

const mockGetOrder = getServerOrderById as jest.Mock;
const mockGetOrders = getServerAmendmentOrders as jest.Mock;
const readOnlyOrder = {
  id: 'order-1',
  orderNumber: 'A-001',
  type: 'DineIn',
  tableLabel: 'T1',
  currency: 'CHF',
  total: 18,
  items: [],
} as unknown as OrderDto;

async function frenchI18n() {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    lng: 'fr',
    fallbackLng: 'fr',
    resources: { fr: { translation: JSON.parse(JSON.stringify(french)) as typeof french } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

describe('flag-off server order read-only locale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrder.mockResolvedValue(readOnlyOrder);
    mockGetOrders.mockResolvedValue({
      items: [readOnlyOrder],
      totalCount: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('loads French amendment copy before showing the read-only order detail', async () => {
    const instance = await frenchI18n();
    expect(instance.getResource('fr', 'translation', 'orderAmendments.feature_disabled')).toBeUndefined();
    expect(instance.getResource('fr', 'translation', 'serverOrders.title')).toBe('Commandes');
    expect(instance.getResource('fr', 'translation', 'serverOrders.search_label')).toBeUndefined();

    render(
      <I18nextProvider i18n={instance}>
        <TenantFeaturesProvider features={{ orderAmendmentsV1: false }}>
          <ServerOrderDetailWorkspace orderId="order-1" />
        </TenantFeaturesProvider>
      </I18nextProvider>,
    );

    expect(
      await screen.findByText('Les modifications de commande ne sont pas activées pour ce restaurant.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'A-001' })).toBeInTheDocument();
    expect(instance.getResource('fr', 'translation', 'orderAmendments.feature_disabled')).toBe(
      'Les modifications de commande ne sont pas activées pour ce restaurant.',
    );
    expect(instance.getResource('fr', 'translation', 'serverOrders.title')).toBe('Commandes');
  });

  it('loads French amendment copy before exposing the read-only order list', async () => {
    const instance = await frenchI18n();
    expect(instance.getResource('fr', 'translation', 'serverOrders.title')).toBe('Commandes');
    expect(instance.getResource('fr', 'translation', 'serverOrders.search_label')).toBeUndefined();
    render(
      <I18nextProvider i18n={instance}>
        <TenantFeaturesProvider features={{ orderAmendmentsV1: false }}>
          <ServerOrdersWorkspace />
        </TenantFeaturesProvider>
      </I18nextProvider>,
    );

    expect(
      await screen.findByText('Les modifications de commande ne sont pas activées pour ce restaurant.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('A-001')).toBeInTheDocument();
    expect(instance.getResource('fr', 'translation', 'orderAmendments.feature_disabled')).toBe(
      'Les modifications de commande ne sont pas activées pour ce restaurant.',
    );
    expect(await screen.findByRole('heading', { name: 'Commandes' })).toBeInTheDocument();
    expect(instance.getResource('fr', 'translation', 'serverOrders.title')).toBe('Commandes');
  });
});
