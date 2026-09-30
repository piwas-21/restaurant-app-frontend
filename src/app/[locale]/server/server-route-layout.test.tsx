import { render, screen } from '@testing-library/react';
import ServerRouteLayout from './layout';

const mockGetTenantFeatures = jest.fn();

jest.mock('@/services/tenantFeaturesService', () => ({
  getTenantFeatures: () => mockGetTenantFeatures(),
}));
jest.mock('./server-layout-client', () => ({
  __esModule: true,
  default: ({ features, children }: { features: { serverWorkspaceV2: boolean }; children: React.ReactNode }) => (
    <section data-testid="server-route-provider" data-server-workspace-v2={String(features.serverWorkspaceV2)}>
      {children}
    </section>
  ),
}));

describe('server route layout', () => {
  it('loads the rollout in the server subtree and passes it to the client provider', async () => {
    mockGetTenantFeatures.mockResolvedValue({ serverWorkspaceV2: true });

    render(await ServerRouteLayout({ children: <p>server route</p> }));

    expect(mockGetTenantFeatures).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('server-route-provider')).toHaveAttribute('data-server-workspace-v2', 'true');
    expect(screen.getByText('server route')).toBeInTheDocument();
  });
});
