import { render, screen } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { useServerTableSession } from '@/hooks/serverWorkspace/useServerTableSession';
import ServerTablePage from './page';

let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useParams: () => ({ tableId: 'table%2F1' }),
  useSearchParams: () => mockSearchParams,
}));
jest.mock('@/app/server/page', () => ({ __esModule: true, default: () => <div data-testid="legacy-server" /> }));
jest.mock('@/hooks/serverWorkspace/useServerTableSession');
jest.mock('@/components/server/ServerTableWorkspace', () => ({
  __esModule: true,
  default: ({
    tableId,
    requestedSessionId,
    requestedOrderId,
  }: {
    tableId: string;
    requestedSessionId?: string;
    requestedOrderId?: string;
  }) => (
    <div data-testid="server-table-workspace" data-session-id={requestedSessionId} data-order-id={requestedOrderId}>
      {tableId}
    </div>
  ),
}));

const mockUseTableSession = useServerTableSession as jest.MockedFunction<typeof useServerTableSession>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockUseTableSession.mockReturnValue({
    table: null,
    session: null,
    isLoading: false,
    isStarting: false,
    isRepairingLegacyOrders: false,
    repairSuccess: false,
    isStale: false,
    error: null,
    blocker: 'unavailable',
    floorConnectionState: 'connected',
    floorLastConfirmed: null,
    refresh: jest.fn(async () => undefined),
    startTable: jest.fn(async () => {
      throw new Error('not used');
    }),
    repairLegacyOrders: jest.fn(async () => {
      throw new Error('not used');
    }),
    canStartTable: false,
    canAddRound: false,
  });
});

describe('/server/tables/[tableId]', () => {
  it('keeps the rollout fallback when V2 is disabled', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: false }}>
        <ServerTablePage />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByTestId('legacy-server')).toBeInTheDocument();
    expect(mockUseTableSession).not.toHaveBeenCalled();
  });

  it('decodes the table identity and preserves task session context', () => {
    mockSearchParams = new URLSearchParams('serviceSessionId=session-7&orderId=order-9');
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: true }}>
        <ServerTablePage />
      </TenantFeaturesProvider>,
    );

    expect(mockUseTableSession).toHaveBeenCalledWith('table/1');
    const workspace = screen.getByTestId('server-table-workspace');
    expect(workspace).toHaveTextContent('table/1');
    expect(workspace).toHaveAttribute('data-session-id', 'session-7');
    expect(workspace).toHaveAttribute('data-order-id', 'order-9');
  });
});
