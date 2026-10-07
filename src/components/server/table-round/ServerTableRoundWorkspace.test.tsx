import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useServerTableRound } from '@/hooks/serverTableRound/useServerTableRound';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import ServerTableRoundWorkspace from './ServerTableRoundWorkspace';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/contexts/TenantFeaturesContext', () => ({ useTenantFeatures: () => ({ orderAmendmentsV1: false }) }));
jest.mock('@/hooks/serverTableRound/useServerTableRound', () => ({ useServerTableRound: jest.fn() }));
jest.mock('@/components/TenantLink', () => ({
  __esModule: true,
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
jest.mock('@/components/catalog/ProductCustomization', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/design-system/OperationalSplitView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ master, detail }: { master: ReactNode; detail: ReactNode }) =>
      React.createElement(React.Fragment, null, master, detail),
  };
});
jest.mock('@/components/design-system/StaffWorkspaceShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/components/server/WaiterBundleCustomization', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/server/tasks/ServerTasksBadge', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/table-service/TableServiceSessionBill', () => ({ __esModule: true, default: () => null }));
jest.mock('./ServerTableRoundCatalog', () => ({ __esModule: true, default: () => null }));
jest.mock('./ServerTableRoundTicket', () => ({ __esModule: true, default: () => null }));

const discardDraft = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useServerTableRound).mockReturnValue({
    items: [{ product: { id: 'soup', name: 'Soup' }, quantity: 1, unitPrice: 8 }],
    operationState: 'unknown',
    createdOrder: null,
    draftRecovered: true,
    phase: 'idle',
    storageBlocked: false,
    error: 'server.round.operation_unknown',
    operationId: 'operation-1',
    retryHydration: jest.fn(),
    resumeDraft: jest.fn(),
    discardDraft,
    reconcile: jest.fn(),
    categories: [],
    products: [],
    isLoading: false,
    catalogError: null,
    selectedCategoryId: null,
    setSelectedCategoryId: jest.fn(),
    searchQuery: '',
    setSearchQuery: jest.fn(),
    retry: jest.fn(),
    tapPendingId: null,
    canAddItems: false,
    favoriteIds: [],
    showFavorites: false,
    setShowFavorites: jest.fn(),
    toggleFavorite: jest.fn(),
    selectedProduct: null,
    selectedBundle: null,
    ticketTotal: 8,
    quote: null,
    customer: undefined,
    setCustomer: jest.fn(),
    notes: '',
    setNotes: jest.fn(),
    setItemQuantity: jest.fn(),
    removeItem: jest.fn(),
    review: jest.fn(),
    canCompose: false,
    closeCustomization: jest.fn(),
    confirmCustomization: jest.fn(),
    closeBundle: jest.fn(),
    confirmBundle: jest.fn(),
  } as unknown as ReturnType<typeof useServerTableRound>);
});

it('disables recovered-draft discard while the operation outcome is unknown and keeps reconciliation available', () => {
  const state = {
    table: null,
    session: { serviceSessionId: 'session-1', roundCount: 1, bill: { remaining: 8, currency: 'CHF', orders: [] } },
    isStale: false,
    canAddRound: true,
    floorConnectionState: 'connected',
    floorLastConfirmed: null,
    refresh: jest.fn(async () => undefined),
  } as unknown as ServerTableSessionState;

  render(<ServerTableRoundWorkspace tableId="T-QA/3" requestedSessionId="session-1" state={state} />);

  const discard = screen.getByRole('button', { name: 'staff.discard_draft' });
  expect(discard).toBeDisabled();
  fireEvent.click(discard);
  expect(discardDraft).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'staff.check_result' })).toBeEnabled();
});
