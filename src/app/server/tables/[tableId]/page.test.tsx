import { render, screen } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { useServerTableSession } from '@/hooks/serverWorkspace/useServerTableSession';
import ServerTablePage from './page';

jest.mock('next/navigation', () => ({ useParams: () => ({ tableId: 'table%2F1' }) }));
jest.mock('@/app/server/page', () => ({ __esModule: true, default: () => <div data-testid="legacy-server" /> }));
jest.mock('@/hooks/serverWorkspace/useServerTableSession');
jest.mock('@/components/server/ServerTableWorkspace', () => ({
  __esModule: true,
  default: ({ tableId }: { tableId: string }) => <div data-testid="server-table-workspace">{tableId}</div>,
}));

const mockUseTableSession = useServerTableSession as jest.MockedFunction<typeof useServerTableSession>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTableSession.mockReturnValue({
    table: null,
    session: null,
    isLoading: false,
    isStarting: false,
    isStale: false,
    error: null,
    blocker: 'unavailable',
    floorConnectionState: 'connected',
    floorLastConfirmed: null,
    refresh: jest.fn(async () => undefined),
    startTable: jest.fn(async () => {
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

  it('decodes and passes only the stable table identity to the V2 workspace', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: true }}>
        <ServerTablePage />
      </TenantFeaturesProvider>,
    );

    expect(mockUseTableSession).toHaveBeenCalledWith('table/1');
    expect(screen.getByTestId('server-table-workspace')).toHaveTextContent('table/1');
  });
});
