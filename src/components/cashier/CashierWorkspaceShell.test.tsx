import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CashierWorkspaceShell from './CashierWorkspaceShell';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${options.count} open orders`,
  }),
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/cashier/orders' }));
jest.mock('@/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('@/components/LanguageSwitcher', () => ({
  __esModule: true,
  default: () => <button type="button">Language</button>,
}));
jest.mock('@/components/ThemeSwitcher', () => ({
  __esModule: true,
  default: () => <button type="button">Theme</button>,
}));
jest.mock('@/components/UserMenu', () => ({ __esModule: true, default: () => <button type="button">User</button> }));
jest.mock('@/components/branding/TenantLogo', () => ({ __esModule: true, default: () => <span>Tenant</span> }));
jest.mock('@/hooks/useRestaurantInfo', () => ({ useRestaurantInfo: () => ({ info: null }) }));
jest.mock('@/hooks/cashier/useCashierOperationalCount', () => ({
  useCashierOperationalCount: () => ({
    count: 2,
    state: 'ready',
    isLoading: false,
    error: null,
    statusMessageKey: 'cashier.workspace.open_count_current',
    refreshCount: jest.fn(),
  }),
}));

describe('CashierWorkspaceShell', () => {
  it('provides only shipped destinations and marks the active route', () => {
    render(
      <CashierWorkspaceShell activeDestination="orders" queueState="ready">
        <p>content</p>
      </CashierWorkspaceShell>,
    );

    expect(screen.getByRole('link', { name: /cashier\.workspace\.orders/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /cashier\.workspace\.history/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByLabelText('2 open orders')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cashier\.workspace\.tables/ })).not.toHaveAttribute('aria-current');
  });

  it('keeps the operational count visible while the destination queue loads', () => {
    render(
      <CashierWorkspaceShell activeDestination="orders" queueState="loading">
        <p>content</p>
      </CashierWorkspaceShell>,
    );

    expect(screen.getByLabelText('2 open orders')).toBeInTheDocument();
    expect(screen.getByText('cashier.workspace.health_connecting')).toBeInTheDocument();
  });
});
