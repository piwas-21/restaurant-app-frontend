import { act, renderHook } from '@testing-library/react';
import { useAdminNavigation } from './useAdminNavigation';
import type { ModuleId } from '@/lib/modules';

const coreModules: ReadonlySet<ModuleId> = new Set(['core']);

describe('admin navigation discovery', () => {
  it('keeps delivery near the menu while hiding services the tenant does not offer', () => {
    const { result } = renderHook(() => useAdminNavigation('/admin/dashboard', coreModules, 'Admin'));
    const paths = result.current.groups.flatMap((group) => group.items.map((item) => item.href));
    expect(paths).toContain('/admin/delivery-channels');
    expect(paths).not.toContain('/admin/reservations-management');
    expect(paths).not.toContain('/admin/customer-discounts');
    expect(paths).not.toContain('/admin/user-groups');
    expect(result.current.groups[0].id).toBe('menu');
    expect(result.current.expanded).toEqual(['menu']);
  });

  it('opens a newly visited section while respecting a user collapse until navigation changes', () => {
    const { result, rerender } = renderHook(({ path }) => useAdminNavigation(path, coreModules, 'Admin'), {
      initialProps: { path: '/admin/api-tokens' },
    });
    expect(result.current.expanded).toEqual(['settings']);
    act(() => result.current.toggle('settings'));
    expect(result.current.expanded).toEqual([]);
    rerender({ path: '/admin/delivery-channels' });
    expect(result.current.expanded).toEqual(['menu']);
  });

  it('removes Admin-only entries and empty groups from a Staff session', () => {
    const { result } = renderHook(() => useAdminNavigation('/admin/dashboard', coreModules, 'Staff'));
    const paths = result.current.groups.flatMap((group) => group.items.map((item) => item.href));
    expect(paths).not.toContain('/admin/api-tokens');
    expect(paths).not.toContain('/admin/delivery-channels');
    expect(paths).toContain('/admin/orders-management');
    expect(result.current.groups.every((group) => group.items.length > 0)).toBe(true);
  });
});
