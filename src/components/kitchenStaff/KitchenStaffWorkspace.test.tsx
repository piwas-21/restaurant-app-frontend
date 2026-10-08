import { fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '@/components/AuthContext';
import { ModulesProvider } from '@/contexts/ModulesContext';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import KitchenStaffWorkspace from './KitchenStaffWorkspace';

jest.mock('@/components/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));
jest.mock('next/dynamic', () => {
  let slot = 0;
  return {
    __esModule: true,
    default: () => {
      const current = slot;
      slot += 1;
      return function DynamicKitchenSurface() {
        return <div data-testid={current === 0 ? 'marketplace-surface' : 'native-kitchen-surface'} />;
      };
    },
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function renderWorkspace(
  features: { tableAccountV1?: boolean; orderAmendmentsV1?: boolean },
  role = 'KitchenStaff',
  modules: 'kitchen-board'[] = ['kitchen-board'],
) {
  mockUseAuth.mockReturnValue({
    user: {
      userId: 'staff-a',
      firstName: 'Kitchen',
      lastName: 'Staff',
      email: '',
      role,
      accessToken: '',
    },
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
  });
  return render(
    <ModulesProvider modules={modules}>
      <TenantFeaturesProvider features={features}>
        <KitchenStaffWorkspace />
      </TenantFeaturesProvider>
    </ModulesProvider>,
  );
}

describe('KitchenStaffWorkspace', () => {
  it('preserves the marketplace surface and does not mount native work when account flags are off', () => {
    renderWorkspace({ tableAccountV1: false, orderAmendmentsV1: false });
    expect(screen.getByTestId('marketplace-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('native-kitchen-surface')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('does not mount native work for an unauthorized role or an unavailable module', () => {
    const { unmount } = renderWorkspace({ tableAccountV1: true }, 'Server');
    expect(screen.queryByTestId('native-kitchen-surface')).not.toBeInTheDocument();
    unmount();

    renderWorkspace({ tableAccountV1: true }, 'KitchenStaff', []);
    expect(screen.queryByTestId('native-kitchen-surface')).not.toBeInTheDocument();
  });

  it('offers native and marketplace tabs when the module and account workflow are enabled', () => {
    renderWorkspace({ tableAccountV1: true });
    expect(screen.getByRole('tab', { name: 'nativeKitchenBoard.nativeTab' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('native-kitchen-surface')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'nativeKitchenBoard.marketplaceTab' }));
    expect(screen.getByRole('tab', { name: 'nativeKitchenBoard.marketplaceTab' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('marketplace-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('native-kitchen-surface')).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'nativeKitchenBoard.marketplaceTab' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'nativeKitchenBoard.nativeTab' })).toHaveAttribute('aria-selected', 'true');
  });
});
