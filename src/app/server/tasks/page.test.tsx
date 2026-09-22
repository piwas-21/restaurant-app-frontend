import { render, screen } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import ServerTasksPage from './page';

jest.mock('@/app/server/page', () => ({ __esModule: true, default: () => <div data-testid="legacy-server" /> }));
jest.mock('@/components/server/tasks/ServerTasksWorkspace', () => ({
  __esModule: true,
  default: () => <div data-testid="server-tasks-workspace" />,
}));

describe('/server/tasks', () => {
  it('keeps the legacy workspace when V2 is disabled', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: false }}>
        <ServerTasksPage />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByTestId('legacy-server')).toBeInTheDocument();
    expect(screen.queryByTestId('server-tasks-workspace')).not.toBeInTheDocument();
  });

  it('opens the service-task workspace only when V2 is enabled', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: true }}>
        <ServerTasksPage />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByTestId('server-tasks-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-server')).not.toBeInTheDocument();
  });
});
