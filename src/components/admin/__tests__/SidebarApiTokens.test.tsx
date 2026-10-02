import { render, screen } from '@testing-library/react';
import Sidebar from '../Sidebar';

/**
 * The platform credential and delivery integration nav entries are Admin-only.
 *
 * The APIs behind both surfaces refuse a Staff JWT, so a visible link would lead a Staff
 * member to pages that can only answer 403.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/admin/dashboard',
}));
jest.mock('@/contexts/ModulesContext', () => ({ useModules: () => new Set(['core']) }));

const mockUser = { role: 'Admin' };
jest.mock('@/components/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/modules', () => ({ moduleForPath: () => null }));

describe('Sidebar — admin-only management entries', () => {
  it('shows the entries to an Admin', () => {
    mockUser.role = 'Admin';

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /API Tokens/ })).toHaveAttribute('href', '/admin/api-tokens');
    expect(screen.getByRole('link', { name: /Delivery channels/ })).toHaveAttribute('href', '/admin/delivery-channels');
  });

  it('hides both entries from Staff, whose session is refused by those endpoints', () => {
    mockUser.role = 'Staff';

    render(<Sidebar />);

    expect(screen.queryByRole('link', { name: /API Tokens/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Delivery channels/ })).not.toBeInTheDocument();
    // Staff keeps the rest of the nav — this gate is one entry, not a role split.
    expect(screen.getByRole('link', { name: /Orders Management/ })).toBeInTheDocument();
  });
});
