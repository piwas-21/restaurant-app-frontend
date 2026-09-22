import { render, screen } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { useServerTableSession } from '@/hooks/serverWorkspace/useServerTableSession';
import ServerTableRoundPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ tableId: 'T-QA%2F3' }),
  useSearchParams: () => new URLSearchParams('serviceSessionId=session-1'),
}));
jest.mock('@/app/server/page', () => ({ __esModule: true, default: () => <div data-testid="legacy-server" /> }));
jest.mock('@/hooks/serverWorkspace/useServerTableSession');
jest.mock('@/components/server/table-round/ServerTableRoundWorkspace', () => ({
  __esModule: true,
  default: ({ tableId, requestedSessionId }: { tableId: string; requestedSessionId?: string }) => (
    <div data-testid="round-workspace">
      {tableId}:{requestedSessionId}
    </div>
  ),
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

it('preserves the decoded stable table id and authoritative session query', () => {
  render(
    <TenantFeaturesProvider features={{ serverWorkspaceV2: true }}>
      <ServerTableRoundPage />
    </TenantFeaturesProvider>,
  );
  expect(mockUseTableSession).toHaveBeenCalledWith('T-QA/3');
  expect(screen.getByTestId('round-workspace')).toHaveTextContent('T-QA/3:session-1');
});

it('keeps the legacy route when the rollout flag is disabled', () => {
  render(
    <TenantFeaturesProvider features={{ serverWorkspaceV2: false }}>
      <ServerTableRoundPage />
    </TenantFeaturesProvider>,
  );
  expect(screen.getByTestId('legacy-server')).toBeInTheDocument();
});
