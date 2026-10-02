import { render, screen } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import ServerMarketplaceWorkspace from './ServerMarketplaceWorkspace';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/server/tasks/ServerTasksBadge', () => ({
  __esModule: true,
  default: function MockServerTasksBadge() {
    return <span>0</span>;
  },
}));
jest.mock('@/components/kitchenStaff/MarketplaceKitchenBoard', () => ({
  __esModule: true,
  default: function MockMarketplaceKitchenBoard({ audience, workspace }: { audience: string; workspace: boolean }) {
    return <div data-testid="marketplace-board" data-audience={audience} data-workspace={String(workspace)} />;
  },
}));
describe('ServerMarketplaceWorkspace', () => {
  it('exposes the shared preparation board from the Server V2 shell without nesting a main landmark', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: true }}>
        <main>
          <ServerMarketplaceWorkspace />
        </main>
      </TenantFeaturesProvider>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByTestId('marketplace-board')).toHaveAttribute('data-audience', 'server');
    expect(screen.getByTestId('marketplace-board')).toHaveAttribute('data-workspace', 'true');
    expect(screen.getByRole('link', { name: 'server.floor_plan' })).toHaveAttribute('href', '/server/floor');
    expect(screen.getByRole('link', { name: 'marketplaceStaff.kitchen_title' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the accepted marketplace board available when the V2 feature is disabled', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: false }}>
        <main>
          <ServerMarketplaceWorkspace />
        </main>
      </TenantFeaturesProvider>,
    );

    expect(screen.getByTestId('marketplace-board')).toHaveAttribute('data-audience', 'server');
    expect(screen.getByRole('link', { name: 'server.floor_plan' })).toHaveAttribute('href', '/server');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
