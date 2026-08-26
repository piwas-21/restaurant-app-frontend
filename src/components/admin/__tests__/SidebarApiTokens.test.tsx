import { render, screen } from '@testing-library/react';
import Sidebar from '../Sidebar';

/**
 * The nav entry for `/admin/api-tokens` is the only Admin-ONLY item in the sidebar.
 *
 * It matters because every OTHER entry is reachable by Staff: the three `/api/ApiTokens`
 * endpoints refuse a Staff JWT (API-TOKENS-PLAN §8), so a visible link would lead a Staff
 * member to a page that can only answer 403.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/admin/dashboard' }));
jest.mock('@/contexts/ModulesContext', () => ({ useModules: () => new Set(['core']) }));

const mockUser = { role: 'Admin' };
jest.mock('@/components/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/modules', () => ({ moduleForPath: () => null }));

describe('Sidebar — API tokens entry', () => {
  it('shows the entry to an Admin', () => {
    mockUser.role = 'Admin';

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /API Tokens/ })).toHaveAttribute('href', '/admin/api-tokens');
  });

  it('hides it from Staff, whose session is refused by every endpoint behind it', () => {
    mockUser.role = 'Staff';

    render(<Sidebar />);

    expect(screen.queryByRole('link', { name: /API Tokens/ })).not.toBeInTheDocument();
    // Staff keeps the rest of the nav — this gate is one entry, not a role split.
    expect(screen.getByRole('link', { name: /Orders Management/ })).toBeInTheDocument();
  });
});
