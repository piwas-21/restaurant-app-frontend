import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { renderToString } from 'react-dom/server.node';

/**
 * The platform credential and delivery integration nav entries are Admin-only.
 *
 * The APIs behind both surfaces refuse a Staff JWT, so a visible link would lead a Staff
 * member to pages that can only answer 403.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      mockTranslated
        ? `translated-${key}`
        : (fallback ??
          {
            'adminNavigation.settings': 'Settings',
            'adminNavigation.operations': 'Orders & service',
            'adminNavigation.menu': 'Menu & sales',
            'adminNavigation.customers': 'Customers',
          }[key] ??
          key),
  }),
}));
let mockPathname = '/admin/dashboard';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => mockPathname,
}));
jest.mock('@/contexts/ModulesContext', () => ({ useModules: () => new Set(['core']) }));

let mockTranslated = false;
const mockUser = { role: 'Admin' };
jest.mock('@/components/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/modules', () => ({ moduleForPath: () => null }));

describe('Sidebar — admin-only management entries', () => {
  beforeEach(() => {
    mockPathname = '/admin/dashboard';
    mockTranslated = false;
  });
  it('shows the entries to an Admin', () => {
    mockUser.role = 'Admin';

    render(<Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('link', { name: /API Tokens/ })).toHaveAttribute('href', '/admin/api-tokens');
    expect(screen.getByRole('link', { name: /Delivery channels/ })).toHaveAttribute('href', '/admin/delivery-channels');
  });

  it('hides both entries from Staff, whose session is refused by those endpoints', () => {
    mockUser.role = 'Staff';

    render(<Sidebar />);

    expect(screen.queryByRole('link', { name: /API Tokens/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Delivery channels/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Orders & service' }));
    // Staff keeps the rest of the nav — this gate is one entry, not a role split.
    expect(screen.getByRole('link', { name: /Orders Management/ })).toBeInTheDocument();
  });

  it('expands the active section and preserves localized links and drawer close', () => {
    mockUser.role = 'Admin';
    mockPathname = '/tr/admin/api-tokens';
    const close = jest.fn();
    render(<Sidebar onClose={close} />);
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(settings).toHaveAttribute('aria-expanded', 'true');
    const link = screen.getByRole('link', { name: /API Tokens/ });
    expect(link).toHaveAttribute('href', '/tr/admin/api-tokens');
    expect(link).toHaveAttribute('aria-current', 'page');
    fireEvent.click(link);
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.click(settings);
    expect(screen.queryByRole('link', { name: /API Tokens/ })).not.toBeInTheDocument();
  });
  it('uses deterministic group headings and navigation label for server rendering in another locale', () => {
    mockUser.role = 'Admin';
    mockPathname = '/tr/admin/menu-management';
    mockTranslated = true;
    const markup = renderToString(<Sidebar />);
    expect(markup).toContain('Menu &amp; sales');
    expect(markup).toContain('aria-label="Administration"');
    expect(markup).not.toContain('translated-adminNavigation');
  });
});
