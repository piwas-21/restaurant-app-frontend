import React from 'react';
import { cleanup, render } from '@testing-library/react';
import RoleNavLinks from './RoleNavLinks';
import { ModulesProvider } from '@/contexts/ModulesContext';
import { MODULE_IDS, type ModuleId } from '@/lib/modules';

const mockUser = jest.fn<{ role: string } | null, []>();
jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/components/AuthContext', () => ({ useAuth: () => ({ user: mockUser(), isLoading: false }) }));
jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ state: { items: [] } }) }));

function renderNav(role: string | null, modules: ModuleId[]) {
  mockUser.mockReturnValue(role ? { role } : null);
  return render(
    <ModulesProvider modules={modules}>
      <RoleNavLinks onNavigate={jest.fn()} />
    </ModulesProvider>,
  );
}

const hrefs = () => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));

/**
 * A nav that offers a route the module guard blocks is worse than no gating at all — the
 * customer clicks it and lands on "not available". This component is the single source of
 * truth for BOTH the customer chrome and (since O5) the staff/admin chrome, so these cases
 * cover every header in the app.
 */
describe('RoleNavLinks module gating', () => {
  it('hides Reservations from a customer when the tenant has no reservations module', () => {
    renderNav(null, ['core']);

    expect(hrefs()).not.toContain('/reservations');
    expect(hrefs()).toEqual(expect.arrayContaining(['/', '/menu', '/cart']));
  });

  it('hides Reservations from an admin too', () => {
    renderNav('admin', ['core']);

    expect(hrefs()).not.toContain('/reservations');
    expect(hrefs()).toContain('/admin/dashboard');
  });

  it('shows Reservations when the tenant bought it', () => {
    renderNav(null, ['core', 'reservations']);

    expect(hrefs()).toContain('/reservations');
  });

  it.each([
    ['cashier', 'cashier' as ModuleId, '/cashier'],
    ['server', 'server' as ModuleId, '/server'],
  ])('renders nothing for a %s whose module is off', (role, moduleId, href) => {
    renderNav(role, ['core']);
    expect(hrefs()).toHaveLength(0);

    // …and the link is back once the module is bought.
    cleanup();
    renderNav(role, ['core', moduleId]);
    expect(hrefs()).toContain(href);
  });

  it('shows everything for an unrestricted tenant', () => {
    // RUMI's shape: no module list, so the service reports the full vocabulary.
    renderNav(null, [...MODULE_IDS]);

    expect(hrefs()).toContain('/reservations');
  });
});
