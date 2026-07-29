import React from 'react';
import { render, screen } from '@testing-library/react';
import ModuleRouteGuard from './ModuleRouteGuard';
import { ModulesProvider } from '@/contexts/ModulesContext';
import { MODULE_IDS, type ModuleId } from '@/lib/modules';

const mockPathname = jest.fn<string, []>();
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

function renderAt(pathname: string, modules: ModuleId[]) {
  mockPathname.mockReturnValue(pathname);
  return render(
    <ModulesProvider modules={modules}>
      <ModuleRouteGuard>
        <p>page content</p>
      </ModuleRouteGuard>
    </ModulesProvider>,
  );
}

const BOUGHT: ModuleId[] = ['core', 'kitchen-board', 'cashier'];

describe('ModuleRouteGuard', () => {
  it('blocks a route whose module the tenant did not buy', () => {
    renderAt('/reservations', BOUGHT);

    expect(screen.queryByText('page content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not available here' })).toBeInTheDocument();
  });

  it('blocks a nested route under a gated prefix', () => {
    // The reason this is one wrapper in the layout rather than a per-page guard: a new
    // sub-route is covered without anyone remembering to add anything.
    renderAt('/admin/user-groups/42', BOUGHT);

    expect(screen.queryByText('page content')).not.toBeInTheDocument();
  });

  it('renders a route whose module the tenant bought', () => {
    renderAt('/cashier', BOUGHT);

    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders a route no module owns', () => {
    renderAt('/menu', BOUGHT);

    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders everything for an unrestricted tenant', () => {
    // RUMI's shape: no module list, so the service reports the full vocabulary.
    renderAt('/reservations', [...MODULE_IDS]);

    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders everything with no provider at all', () => {
    // This wraps every page in the app, so its failure mode must be "shows too much".
    mockPathname.mockReturnValue('/reservations');
    render(
      <ModuleRouteGuard>
        <p>page content</p>
      </ModuleRouteGuard>,
    );

    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders when the pathname is unavailable', () => {
    mockPathname.mockReturnValue(null as unknown as string);
    render(
      <ModulesProvider modules={BOUGHT}>
        <ModuleRouteGuard>
          <p>page content</p>
        </ModuleRouteGuard>
      </ModulesProvider>,
    );

    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});
