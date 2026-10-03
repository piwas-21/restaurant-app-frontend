import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import CashierLayoutClient from './cashier-layout-client';

const mockPush = jest.fn();
const mockAuth = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => null,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/components/AuthContext', () => ({ useAuth: () => mockAuth() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function FeatureProbe() {
  const { tableAccountV1 } = useTenantFeatures();
  return <output>{String(tableAccountV1)}</output>;
}

describe('CashierLayout authorization', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAuth.mockReturnValue({ user: { role: 'cashier' }, isLoading: false });
  });

  it('does not render cashier children for another authenticated role', () => {
    mockAuth.mockReturnValue({ user: { role: 'server' }, isLoading: false });
    render(
      <CashierLayoutClient features={{ serverWorkspaceV2: false, tableAccountV1: false, orderAmendmentsV1: false }}>
        <p>private queue</p>
      </CashierLayoutClient>,
    );

    expect(screen.queryByText('private queue')).not.toBeInTheDocument();
    // An unauthorized but signed-in user reads why the screen is empty instead of a blank page.
    expect(screen.getByText('cashier.workspace.not_authorized')).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders children for cashier and admin roles', () => {
    const { rerender } = render(
      <CashierLayoutClient features={{ serverWorkspaceV2: false, tableAccountV1: true, orderAmendmentsV1: false }}>
        <p>private queue</p>
      </CashierLayoutClient>,
    );
    expect(screen.getByText('private queue')).toBeInTheDocument();

    mockAuth.mockReturnValue({ user: { role: 'ADMIN' }, isLoading: false });
    rerender(
      <CashierLayoutClient features={{ serverWorkspaceV2: false, tableAccountV1: true, orderAmendmentsV1: false }}>
        <p>private queue</p>
      </CashierLayoutClient>,
    );
    expect(screen.getByText('private queue')).toBeInTheDocument();
  });

  it('provides the tenant table-account flag to authorized cashier routes', () => {
    render(
      <CashierLayoutClient features={{ serverWorkspaceV2: false, tableAccountV1: true, orderAmendmentsV1: false }}>
        <FeatureProbe />
      </CashierLayoutClient>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('true');
  });

  it('uses the scoped stylesheet for the loading spinner animation', () => {
    mockAuth.mockReturnValue({ user: null, isLoading: true });
    const { container } = render(
      <CashierLayoutClient features={{ serverWorkspaceV2: false, tableAccountV1: false, orderAmendmentsV1: false }}>
        <p>private queue</p>
      </CashierLayoutClient>,
    );

    const spinner = container.querySelector('svg');
    expect(spinner).toHaveClass('spinner');
    expect(spinner).not.toHaveAttribute('style');
  });
});
